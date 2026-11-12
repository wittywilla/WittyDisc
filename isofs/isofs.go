// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors

// Package isofs reads files out of optical disc images (ISO 9660 and UDF)
// without mounting them. It is WittyDisc, shared by WittyDVD and WittyBluray. DVD-Video discs are UDF/ISO 9660 "bridge" discs, so
// UDF is tried first and ISO 9660 is the fallback.
//
// Files are described as byte extents inside the image. That lets callers hand
// the raw VOB ranges to FFmpeg (via the subfile protocol) or read them directly.
package isofs

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"sort"
	"strings"
)

const Sector = 2048

// Extent is a contiguous byte range inside the image file.
//
// An extent with Zero set is part of the file that the disc does not record
// (UDF "allocated but not recorded" or "not allocated"): it reads as Length
// zero bytes, and its Offset is -1 so that it can't be mistaken for bytes of
// the image. A file's Size may also run past the end of its extents, and that
// rest reads as zeros too.
type Extent struct {
	Offset int64 `json:"offset"`
	Length int64 `json:"length"`
	Zero   bool  `json:"zero,omitempty"`
}

// File is a file found on the disc.
type File struct {
	Path    string   `json:"path"` // forward-slash path, e.g. VIDEO_TS/VTS_01_0.IFO
	Size    int64    `json:"size"`
	Extents []Extent `json:"extents"`
	IsDir   bool     `json:"isDir,omitempty"`
}

// Disc is an opened disc image.
// image is where a disc's bytes come from.
type image interface {
	io.ReaderAt
	io.Closer
}

type Disc struct {
	Path   string
	Format string // "udf", "iso9660"
	Label  string

	f     image
	size  int64
	files map[string]*File // upper-cased path -> file

	walked      map[int64]bool // directories already read while indexing
	dirBytes    int64
	entries     int
	extentCount int // UDF extents of all files, for the limit
	udfSkipped  int // UDF entries that could not be read
}

var ErrNotFound = errors.New("isofs: file not found")

// Open opens an image file and indexes its directory tree.
func Open(p string) (*Disc, error) {
	f, err := os.Open(p)
	if err != nil {
		return nil, err
	}
	st, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, err
	}
	d := &Disc{Path: p, f: f, size: st.Size(), files: map[string]*File{}}
	if err := d.index(); err != nil {
		f.Close()
		return nil, err
	}
	return d, nil
}

func (d *Disc) Close() error { return d.f.Close() }

// Size is the image size in bytes.
func (d *Disc) Size() int64 { return d.size }

// Files returns all files on the disc sorted by path.
func (d *Disc) Files() []*File {
	out := make([]*File, 0, len(d.files))
	for _, f := range d.files {
		out = append(out, f)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Path < out[j].Path })
	return out
}

// Find returns a file by case-insensitive path.
func (d *Disc) Find(p string) (*File, bool) {
	f, ok := d.files[strings.ToUpper(strings.Trim(path.Clean("/"+p), "/"))]
	return f, ok
}

// ReadFile reads a whole file (bounded by max bytes; 0 = unlimited).
func (d *Disc) ReadFile(p string, max int64) ([]byte, error) {
	f, ok := d.Find(p)
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrNotFound, p)
	}
	// A file's size is whatever the image says. Nothing can be longer than the
	// image itself, so that is all the memory a read may ask for.
	n := min(f.Size, d.size)
	if max > 0 && n > max {
		n = max
	}
	if n < 0 {
		return nil, fmt.Errorf("isofs: %s has a negative size", p)
	}
	// Sizes come from the image: nothing bigger than the image itself can be
	// in it, whatever a directory entry says.
	if n > d.size {
		n = d.size
	}
	buf := make([]byte, n)
	got, err := d.ReadAtFile(f, buf, 0)
	return buf[:got], err
}

// ReadAtFile reads from a file at a logical offset, spanning extents as needed.
// Extents the disc does not record, and whatever of the file's size lies past
// its extents, read as zeros.
func (d *Disc) ReadAtFile(f *File, buf []byte, off int64) (int, error) {
	if off < 0 {
		return 0, errors.New("isofs: negative offset")
	}
	total := 0
	at := off // the file's position of buf[total]
	var end int64
	for _, e := range f.Extents {
		end += e.Length
		if total >= len(buf) {
			break
		}
		if off >= e.Length {
			off -= e.Length
			continue
		}
		want := min(int64(len(buf)-total), e.Length-off)
		if e.Zero {
			clear(buf[total : total+int(want)])
			total += int(want)
		} else {
			n, err := d.f.ReadAt(buf[total:total+int(want)], e.Offset+off)
			total += n
			if err != nil && !errors.Is(err, io.EOF) {
				return total, err
			}
			if int64(n) < want {
				return total, io.EOF // the image ends early
			}
		}
		off = 0
	}
	if at += int64(total); total < len(buf) && at >= end && at < f.Size {
		n := int(min(int64(len(buf)-total), f.Size-at))
		clear(buf[total : total+n])
		total += n
	}
	if total < len(buf) {
		return total, io.EOF
	}
	return total, nil
}

// ReadSectors reads raw sectors from the image (absolute sector numbers).
func (d *Disc) ReadSectors(first, count int64) ([]byte, error) {
	buf := make([]byte, count*Sector)
	n, err := d.f.ReadAt(buf, first*Sector)
	if err != nil && !errors.Is(err, io.EOF) {
		return nil, err
	}
	return buf[:n], nil
}

// Reader returns an io.ReaderAt over a file's logical bytes.
func (d *Disc) Reader(f *File) io.ReaderAt { return &fileReader{d: d, f: f} }

type fileReader struct {
	d *Disc
	f *File
}

func (r *fileReader) ReadAt(p []byte, off int64) (int, error) { return r.d.ReadAtFile(r.f, p, off) }

func (d *Disc) index() error {
	udfErr := d.indexUDF()
	if udfErr == nil && len(d.files) > 0 {
		d.Format = "udf"
		return nil
	}
	if udfErr == nil {
		udfErr = errors.New("no files")
	}
	d.files = map[string]*File{}
	d.walked, d.dirBytes, d.entries, d.extentCount, d.udfSkipped = nil, 0, 0, 0, 0
	if err := d.indexISO9660(); err != nil {
		return fmt.Errorf("isofs: not a readable UDF (%v) or ISO 9660 (%v) image", udfErr, err)
	}
	d.Format = "iso9660"
	return nil
}

func (d *Disc) add(f *File) {
	f.Path = strings.Trim(f.Path, "/")
	d.files[strings.ToUpper(f.Path)] = f
}

// A real disc holds hundreds of files. These bound what a crafted image can
// make the walk do: directories that list each other are read once, not once
// per path through them, which from a tiny file would never end.
const (
	maxFiles    = 200000
	maxDirBytes = 256 << 20 // directory data read in total
	maxEntries  = 1 << 20   // directory entries read in total
)

// enterDir says whether to read a directory at this place in the image.
func (d *Disc) enterDir(at int64, size int64) error {
	if d.walked == nil {
		d.walked = map[int64]bool{}
	}
	if d.walked[at] {
		return errSeen
	}
	d.walked[at] = true
	d.dirBytes += size
	if d.dirBytes > maxDirBytes || len(d.files) > maxFiles {
		return errLimit
	}
	return nil
}

var (
	errSeen  = errors.New("isofs: directory already read")
	errLimit = errors.New("isofs: the directory tree is too large")
)

// nextEntry counts a directory entry. A UDF entry means reading another
// sector, so a few megabytes of crafted directory could otherwise keep a disk
// busy for minutes.
func (d *Disc) nextEntry() error {
	d.entries++
	if d.entries > maxEntries {
		return errLimit
	}
	return nil
}

func (d *Disc) sector(n int64) ([]byte, error) {
	if n < 0 || n*Sector >= d.size {
		return nil, fmt.Errorf("isofs: sector %d outside image", n)
	}
	b := make([]byte, Sector)
	if _, err := d.f.ReadAt(b, n*Sector); err != nil && !errors.Is(err, io.EOF) {
		return nil, err
	}
	return b, nil
}

// ---------------------------------------------------------------------------
// ISO 9660
// ---------------------------------------------------------------------------

func (d *Disc) indexISO9660() error {
	var root []byte
	for s := int64(16); s < 64; s++ {
		b, err := d.sector(s)
		if err != nil {
			return err
		}
		if string(b[1:6]) != "CD001" {
			return errors.New("no primary volume descriptor")
		}
		switch b[0] {
		case 1:
			if root == nil {
				root = append([]byte(nil), b[156:190]...)
				d.Label = strings.Trim(string(b[40:72]), " \x00")
			}
		case 2:
			// Joliet supplementary descriptor - prefer it for long names, but
			// DVD-Video names are 8.3 so ISO level is fine. Skip.
		case 255:
			if root == nil {
				return errors.New("no primary volume descriptor")
			}
			return d.walkISODir(root, "", 0)
		}
	}
	return errors.New("volume descriptor set terminator not found")
}

func (d *Disc) walkISODir(rec []byte, prefix string, depth int) error {
	if depth > 16 {
		return nil
	}
	lba := int64(binary.LittleEndian.Uint32(rec[2:6]))
	size := int64(binary.LittleEndian.Uint32(rec[10:14]))
	if size <= 0 || size > 64<<20 {
		return nil
	}
	if err := d.enterDir(lba, size); errors.Is(err, errSeen) {
		return nil
	} else if err != nil {
		return err
	}
	buf := make([]byte, size)
	if _, err := d.f.ReadAt(buf, lba*Sector); err != nil && !errors.Is(err, io.EOF) {
		return err
	}
	for off := 0; off < len(buf); {
		l := int(buf[off])
		if l == 0 {
			// Records never span sectors; skip to next sector boundary.
			off = (off/Sector + 1) * Sector
			continue
		}
		if off+l > len(buf) || l < 33 {
			break
		}
		if err := d.nextEntry(); err != nil {
			return err
		}
		r := buf[off : off+l]
		nameLen := int(r[32])
		if 33+nameLen > l {
			break
		}
		name := string(r[33 : 33+nameLen])
		flags := r[25]
		off += l
		if nameLen == 1 && (name == "\x00" || name == "\x01") {
			continue
		}
		if i := strings.IndexByte(name, ';'); i >= 0 {
			name = name[:i]
		}
		name = strings.TrimSuffix(name, ".")
		full := prefix + "/" + name
		if flags&2 != 0 {
			d.add(&File{Path: full, IsDir: true})
			if err := d.walkISODir(r, full, depth+1); err != nil {
				return err
			}
			continue
		}
		fl := int64(binary.LittleEndian.Uint32(r[2:6]))
		fs := int64(binary.LittleEndian.Uint32(r[10:14]))
		f := &File{Path: full, Size: fs}
		if fs > 0 {
			f.Extents = []Extent{{Offset: fl * Sector, Length: fs}}
		}
		// Multi-extent files (>4GiB) use the same name in consecutive records
		// with the "not final" flag; merge them.
		key := strings.ToUpper(strings.Trim(full, "/"))
		if prev, ok := d.files[key]; ok && !prev.IsDir {
			prev.Size += fs
			prev.Extents = append(prev.Extents, f.Extents...)
			continue
		}
		d.add(f)
	}
	return nil
}

// ---------------------------------------------------------------------------
// UDF (ECMA-167 / OSTA UDF 1.02 as used by DVD-Video, UDF 2.50 with a
// metadata partition as used by Blu-ray, and the sparable and virtual
// partitions of rewritable and incrementally written discs)
// ---------------------------------------------------------------------------

type udfPartition struct {
	number uint16
	start  int64 // in sectors
	length int64
}

// Partition map types, as this reader tells them apart.
const (
	mapUnknown  = iota // a map this reader does not know: using it is an error
	mapPhysical        // type 1: blocks of a partition, in order
	mapMetadata        // UDF 2.50: blocks of the metadata file
	mapSparable        // UDF 1.50: a physical partition whose bad packets moved elsewhere
	mapVirtual         // UDF 1.50: blocks looked up in the virtual allocation table
)

// udfMap is one partition map of the logical volume. Partition reference
// numbers in long_ads index the map list.
type udfMap struct {
	kind      int
	ident     string // the map's identifier, for errors about a map not understood
	partition uint16 // the physical partition number

	// metadata partition: the metadata file's block in the physical
	// partition, its mirror's, and the extents of the one being used.
	metaFile, metaMirror uint32
	extents              []Extent
	mirror               []Extent // the mirror's extents, when they could be read
	onMirror             bool

	// sparable partition: packets that moved, by their first block, to the
	// absolute sector they moved to.
	packet  uint32
	tables  []uint32 // sectors of the copies of the sparing table
	tableSz uint32
	spared  map[uint32]uint32

	// virtual partition: the virtual allocation table, block -> block of the
	// physical partition.
	vat []uint32
}

type udfCtx struct {
	parts  []udfPartition
	maps   []udfMap
	fsdLoc longAD
	steps  int // blocks looked up one at a time, for the limit
}

type longAD struct {
	length uint32
	block  uint32
	part   uint16
}

func readLongAD(b []byte) longAD {
	return longAD{
		length: binary.LittleEndian.Uint32(b[0:4]) & 0x3fffffff,
		block:  binary.LittleEndian.Uint32(b[4:8]),
		part:   binary.LittleEndian.Uint16(b[8:10]),
	}
}

// Bounds on the UDF walk, generous for any real disc: a 100 GB Blu-ray in
// extents of a gigabyte has a few hundred, a fragmented rewritable disc some
// thousands.
const (
	maxUDFDepth    = 32       // directory levels
	maxUDFDir      = 64 << 20 // bytes of one directory
	maxADHops      = 1 << 16  // allocation extent blocks one file's descriptors may continue into
	maxExtents     = 4 << 20  // extents of all files together
	maxMapSteps    = 1 << 26  // blocks looked up one by one (sparable packets, virtual blocks)
	maxVATBytes    = 64 << 20 // a virtual allocation table of 16 million blocks
	maxSparingSize = 1 << 20  // bytes of one sparing table
	vatSearch      = 512      // sectors before the end of the image searched for the VAT
)

func (d *Disc) indexUDF() error {
	// Anchor volume descriptor pointer at sector 256 (or 512, N-1, N-257).
	var anchor []byte
	for _, s := range []int64{256, 512, d.size/Sector - 1, d.size/Sector - 257} {
		b, err := d.sector(s)
		if err != nil {
			continue
		}
		if binary.LittleEndian.Uint16(b[0:2]) == 2 { // AVDP
			anchor = b
			break
		}
	}
	if anchor == nil {
		return errors.New("no UDF anchor")
	}
	// The main volume descriptor sequence, and the reserve copy of it if the
	// main one is unreadable.
	var ctx *udfCtx
	var err error
	for _, at := range []int{16, 24} {
		if ctx, err = d.udfVolume(anchor[at : at+8]); err == nil {
			break
		}
	}
	if err != nil {
		return err
	}
	if err := d.udfPartitions(ctx); err != nil {
		return err
	}
	err = d.udfWalk(ctx)
	if err == nil && d.udfSkipped == 0 {
		return nil
	}
	// A metadata partition whose main file reads badly (the file set or a
	// directory can't be found through it) is read again through its
	// mirror, and the better of the two readings is kept.
	mirrored := false
	for i := range ctx.maps {
		if m := &ctx.maps[i]; m.kind == mapMetadata && m.mirror != nil && !m.onMirror {
			m.extents, m.onMirror, mirrored = m.mirror, true, true
		}
	}
	if !mirrored {
		return err
	}
	first, firstErr := *d, err
	if err = d.udfWalk(ctx); err == nil && (firstErr != nil || d.udfSkipped < first.udfSkipped) {
		return nil
	}
	*d = first
	return firstErr
}

// udfWalk indexes the directory tree from the file set descriptor.
func (d *Disc) udfWalk(ctx *udfCtx) error {
	d.files = map[string]*File{}
	d.walked, d.dirBytes, d.entries, d.extentCount, d.udfSkipped = nil, 0, 0, 0, 0
	fsdSec, err := ctx.abs(ctx.fsdLoc.part, ctx.fsdLoc.block)
	if err != nil {
		return err
	}
	fsd, err := d.sector(fsdSec)
	if err != nil {
		return err
	}
	if binary.LittleEndian.Uint16(fsd[0:2]) != 256 {
		return errors.New("UDF file set descriptor missing")
	}
	return d.walkUDFDir(ctx, readLongAD(fsd[400:416]), "", 0)
}

// udfVolume reads a volume descriptor sequence (extent ad at b): the
// partitions, the partition maps and where the file set is.
func (d *Disc) udfVolume(b []byte) (*udfCtx, error) {
	seqLen := int64(binary.LittleEndian.Uint32(b[0:4]))
	seqLoc := int64(binary.LittleEndian.Uint32(b[4:8]))
	ctx := &udfCtx{}
	gotLVD := false
	for i := int64(0); i < seqLen/Sector && i < 64; i++ {
		b, err := d.sector(seqLoc + i)
		if err != nil {
			break
		}
		tag := binary.LittleEndian.Uint16(b[0:2])
		switch tag {
		case 1: // Primary volume descriptor
			d.Label = decodeDString(b[24:56])
		case 5: // Partition descriptor
			ctx.parts = append(ctx.parts, udfPartition{
				number: binary.LittleEndian.Uint16(b[22:24]),
				start:  int64(binary.LittleEndian.Uint32(b[188:192])),
				length: int64(binary.LittleEndian.Uint32(b[192:196])),
			})
		case 6: // Logical volume descriptor
			if gotLVD {
				continue
			}
			if bs := binary.LittleEndian.Uint32(b[212:216]); bs != 0 && bs != Sector {
				return nil, fmt.Errorf("UDF logical blocks of %d bytes are not supported", bs)
			}
			// Logical volume contents use is a long_ad to the file set descriptor.
			ctx.fsdLoc = readLongAD(b[248:264])
			gotLVD = true
			mapsLen := int(binary.LittleEndian.Uint32(b[264:268]))
			nMaps := int(binary.LittleEndian.Uint32(b[268:272]))
			for off, n := 440, 0; n < nMaps && n < 64 && off+2 <= len(b) && off < 440+mapsLen; n++ {
				typ, l := b[off], int(b[off+1])
				if l < 2 || off+l > len(b) {
					break
				}
				ctx.maps = append(ctx.maps, parseUDFMap(typ, b[off:off+l]))
				off += l
			}
		case 8: // Terminating descriptor
			i = 1 << 40
		}
	}
	if !gotLVD || len(ctx.parts) == 0 {
		return nil, errors.New("UDF volume descriptors incomplete")
	}
	return ctx, nil
}

func parseUDFMap(typ byte, b []byte) udfMap {
	le16 := func(o int) uint16 { return binary.LittleEndian.Uint16(b[o : o+2]) }
	le32 := func(o int) uint32 { return binary.LittleEndian.Uint32(b[o : o+4]) }
	if typ == 1 && len(b) >= 6 {
		return udfMap{kind: mapPhysical, partition: le16(4)}
	}
	if typ != 2 || len(b) < 40 {
		return udfMap{ident: fmt.Sprintf("type %d", typ)}
	}
	m := udfMap{ident: strings.TrimRight(string(b[5:28]), "\x00 "), partition: le16(38)}
	switch {
	case strings.HasPrefix(m.ident, "*UDF Metadata Partition") && len(b) >= 48:
		m.kind = mapMetadata
		m.metaFile, m.metaMirror = le32(40), le32(44)
	case strings.HasPrefix(m.ident, "*UDF Sparable Partition") && len(b) >= 48:
		m.kind = mapSparable
		m.packet = uint32(le16(40))
		m.tableSz = le32(44)
		for i := 0; i < int(b[42]) && 48+4*i+4 <= len(b); i++ {
			m.tables = append(m.tables, le32(48+4*i))
		}
	case strings.HasPrefix(m.ident, "*UDF Virtual Partition"):
		m.kind = mapVirtual
	}
	return m
}

// physRef is the reference number of the physical map of a partition,
// adding one when the volume names none.
func (c *udfCtx) physRef(number uint16) uint16 {
	for j, pm := range c.maps {
		if pm.kind == mapPhysical && pm.partition == number {
			return uint16(j)
		}
	}
	c.maps = append(c.maps, udfMap{kind: mapPhysical, partition: number})
	return uint16(len(c.maps) - 1)
}

// udfPartitions reads what the partition maps need before anything on them
// is looked up: sparing tables, the virtual allocation table, and the files
// that hold a metadata partition's blocks.
func (d *Disc) udfPartitions(ctx *udfCtx) error {
	for i := range ctx.maps {
		m := &ctx.maps[i]
		switch m.kind {
		case mapSparable:
			if err := d.udfSparing(ctx, m); err != nil {
				return err
			}
		case mapVirtual:
			if err := d.udfVAT(ctx, i); err != nil {
				return err
			}
		}
	}
	for i := range ctx.maps {
		m := &ctx.maps[i]
		if m.kind != mapMetadata {
			continue
		}
		ref := ctx.physRef(m.partition)
		var errs [2]error
		for k, loc := range []uint32{m.metaFile, m.metaMirror} {
			fe, err := d.readUDFEntry(ctx, longAD{block: loc, part: ref})
			if err == nil && len(fe.extents) == 0 {
				err = errors.New("empty metadata file")
			}
			if errs[k] = err; err != nil {
				continue
			}
			if k == 0 {
				m.extents = fe.extents
			} else if loc != m.metaFile {
				m.mirror = fe.extents
			}
		}
		switch {
		case m.extents == nil && m.mirror == nil:
			return fmt.Errorf("UDF metadata partition: %w (mirror: %v)", errs[0], errs[1])
		case m.extents == nil:
			m.extents, m.mirror, m.onMirror = m.mirror, nil, true
		}
	}
	return nil
}

// udfSparing reads the first readable copy of a sparable partition's
// sparing table (UDF 2.2.12).
func (d *Disc) udfSparing(ctx *udfCtx, m *udfMap) error {
	if m.packet == 0 || m.packet&(m.packet-1) != 0 {
		return fmt.Errorf("UDF sparable partition: packet length %d", m.packet)
	}
	if _, err := ctx.physical(m.partition); err != nil {
		return err
	}
	size := int64(min(m.tableSz, maxSparingSize))
	for _, loc := range m.tables {
		buf := make([]byte, max(size, 56))
		n, err := d.f.ReadAt(buf, int64(loc)*Sector)
		if (err != nil && !errors.Is(err, io.EOF)) || n < 56 {
			continue
		}
		buf = buf[:n]
		if !strings.HasPrefix(string(buf[17:40]), "*UDF Sparing Table") {
			continue
		}
		entries := int(binary.LittleEndian.Uint16(buf[48:50]))
		m.spared = map[uint32]uint32{}
		for i := 0; i < entries && 56+8*i+8 <= len(buf); i++ {
			orig := binary.LittleEndian.Uint32(buf[56+8*i:])
			if orig < 0xfffffff0 {
				m.spared[orig] = binary.LittleEndian.Uint32(buf[60+8*i:])
			}
		}
		return nil
	}
	return errors.New("UDF sparable partition: no readable sparing table")
}

// udfVAT finds the virtual allocation table of an incrementally written disc
// (UDF 2.2.11): the file last written, at the end of the image.
func (d *Disc) udfVAT(ctx *udfCtx, i int) error {
	m := &ctx.maps[i]
	p, err := ctx.physical(m.partition)
	if err != nil {
		return err
	}
	ref := ctx.physRef(m.partition)
	m = &ctx.maps[i] // physRef may have grown the list
	last := d.size/Sector - 1
	for s := last; s >= max(p.start, last-vatSearch); s-- {
		b, err := d.sector(s)
		if err != nil {
			continue
		}
		if tag := binary.LittleEndian.Uint16(b[0:2]); tag != 261 && tag != 266 {
			continue
		}
		fe, err := d.readUDFEntry(ctx, longAD{block: uint32(s - p.start), part: ref})
		if err != nil || fe.size <= 0 || fe.size > min(maxVATBytes, d.size) || (fe.fileType != 248 && fe.fileType != 0) {
			continue
		}
		data := fe.inline
		if data == nil {
			data = make([]byte, fe.size)
			if n, err := d.ReadAtFile(&File{Size: fe.size, Extents: fe.extents}, data, 0); err != nil || n != len(data) {
				continue
			}
		}
		var table []byte
		switch {
		case fe.fileType == 248 && len(data) >= 4: // UDF 2.00 and later: a header, then the table
			hd := int(binary.LittleEndian.Uint16(data[0:2]))
			if hd > len(data) {
				continue
			}
			table = data[hd:]
		case fe.fileType == 0 && len(data) >= 36 && strings.HasPrefix(string(data[len(data)-35:]), "*UDF Virtual Alloc Tbl"): // UDF 1.50
			table = data[:len(data)-36]
		default:
			continue
		}
		m.vat = make([]uint32, len(table)/4)
		for k := range m.vat {
			m.vat[k] = binary.LittleEndian.Uint32(table[4*k:])
		}
		return nil
	}
	return errors.New("UDF virtual partition: no virtual allocation table at the end of the image (an incrementally written disc must end with one)")
}

func (c *udfCtx) physical(number uint16) (*udfPartition, error) {
	for i := range c.parts {
		if c.parts[i].number == number || len(c.parts) == 1 {
			return &c.parts[i], nil
		}
	}
	return nil, fmt.Errorf("UDF partition %d not found", number)
}

// abs turns a partition reference number and a logical block into an
// absolute sector of the image.
func (c *udfCtx) abs(partRef uint16, block uint32) (int64, error) {
	ext, err := c.mapRun(partRef, block, 1)
	if err != nil {
		return 0, err
	}
	return ext[0].Offset / Sector, nil
}

// mapRun maps length bytes from a logical block of a partition onto the
// image: one extent for a physical partition, several where the blocks lie
// apart (a metadata file's extents, spared packets, virtual blocks).
func (c *udfCtx) mapRun(partRef uint16, block uint32, length int64) ([]Extent, error) {
	if int(partRef) >= len(c.maps) {
		// No usable map table: reference numbers equal partition numbers.
		p, err := c.physical(partRef)
		if err != nil {
			return nil, err
		}
		return []Extent{{Offset: (p.start + int64(block)) * Sector, Length: length}}, nil
	}
	m := &c.maps[partRef]
	var out []Extent
	add := func(at, n int64) {
		if k := len(out) - 1; k >= 0 && out[k].Offset+out[k].Length == at {
			out[k].Length += n
			return
		}
		out = append(out, Extent{Offset: at, Length: n})
	}
	blocks := (length + Sector - 1) / Sector
	switch m.kind {
	case mapPhysical:
		p, err := c.physical(m.partition)
		if err != nil {
			return nil, err
		}
		return []Extent{{Offset: (p.start + int64(block)) * Sector, Length: length}}, nil
	case mapMetadata:
		off, left := int64(block)*Sector, length
		for _, e := range m.extents {
			if left == 0 {
				break
			}
			if off >= e.Length {
				off -= e.Length
				continue
			}
			if e.Zero {
				return nil, fmt.Errorf("UDF: block %d of the metadata partition is not recorded", block)
			}
			n := min(e.Length-off, left)
			add(e.Offset+off, n)
			left -= n
			off = 0
		}
		if left > 0 {
			return nil, fmt.Errorf("UDF: block %d outside the metadata partition", block)
		}
		return out, nil
	case mapSparable:
		p, err := c.physical(m.partition)
		if err != nil {
			return nil, err
		}
		for b := int64(block); b < int64(block)+blocks; {
			pkt := uint32(b) &^ (m.packet - 1)
			within := uint32(b) - pkt
			n := min(int64(m.packet-within), int64(block)+blocks-b)
			at := p.start + b
			if to, ok := m.spared[pkt]; ok {
				at = int64(to) + int64(within)
			}
			if c.steps++; c.steps > maxMapSteps {
				return nil, fmt.Errorf("%w: too many blocks to look up", errLimit)
			}
			add(at*Sector, n*Sector)
			b += n
		}
	case mapVirtual:
		p, err := c.physical(m.partition)
		if err != nil {
			return nil, err
		}
		for b := int64(block); b < int64(block)+blocks; b++ {
			if b >= int64(len(m.vat)) || m.vat[b] == 0xffffffff {
				return nil, fmt.Errorf("UDF: virtual block %d is not in the allocation table", b)
			}
			if c.steps++; c.steps > maxMapSteps {
				return nil, fmt.Errorf("%w: too many blocks to look up", errLimit)
			}
			add((p.start+int64(m.vat[b]))*Sector, Sector)
		}
	default:
		return nil, fmt.Errorf("UDF: partition map %d (%s) is not supported", partRef, m.ident)
	}
	// Whole blocks were mapped; the run ends where its length does.
	over := blocks*Sector - length
	for k := len(out) - 1; k >= 0 && over > 0; k-- {
		cut := min(over, out[k].Length)
		out[k].Length -= cut
		over -= cut
		if out[k].Length == 0 {
			out = out[:k]
		}
	}
	return out, nil
}

// udfExtents collects a file's extents from its allocation descriptors
// (short_ad 8 bytes, long_ad 16, ext_ad 20), following "next extent of
// descriptors" entries (type 3) into further descriptor blocks, as large
// or fragmented files have. Extents allocated but not recorded, or neither
// (types 1 and 2), read as zeros.
func (d *Disc) udfExtents(ctx *udfCtx, e *udfEntry, ads []byte, adType uint16, partRef uint16) error {
	size := [3]int{8, 16, 20}[adType]
	for hops := 0; ; hops++ {
		var next *longAD
		for i := 0; i+size <= len(ads); i += size {
			raw := binary.LittleEndian.Uint32(ads[i : i+4])
			typ, l := raw>>30, int64(raw&0x3fffffff)
			if l == 0 {
				break
			}
			block, part, recorded, had := uint32(0), partRef, l, len(e.extents)
			switch adType {
			case 0:
				block = binary.LittleEndian.Uint32(ads[i+4 : i+8])
			case 1:
				ad := readLongAD(ads[i : i+16])
				block, part = ad.block, ad.part
			case 2:
				recorded = min(l, int64(binary.LittleEndian.Uint32(ads[i+4:i+8])&0x3fffffff))
				block = binary.LittleEndian.Uint32(ads[i+12 : i+16])
				part = binary.LittleEndian.Uint16(ads[i+16 : i+18])
			}
			if typ == 3 {
				next = &longAD{length: uint32(l), block: block, part: part}
				break
			}
			if typ == 0 && recorded > 0 {
				ext, err := ctx.mapRun(part, block, recorded)
				if err != nil {
					return err
				}
				e.extents = append(e.extents, ext...)
			} else {
				recorded = 0
			}
			if l > recorded {
				e.extents = append(e.extents, Extent{Offset: -1, Length: l - recorded, Zero: true})
			}
			if d.extentCount += len(e.extents) - had; d.extentCount > maxExtents {
				return fmt.Errorf("%w: too many extents", errLimit)
			}
		}
		if next == nil {
			return nil
		}
		if hops >= maxADHops {
			return errors.New("UDF: allocation descriptor chain too long")
		}
		if err := d.nextEntry(); err != nil {
			return err
		}
		s, err := ctx.abs(next.part, next.block)
		if err != nil {
			return err
		}
		b, err := d.sector(s)
		if err != nil {
			return err
		}
		if binary.LittleEndian.Uint16(b[0:2]) != 258 {
			return errors.New("UDF: bad allocation extent descriptor")
		}
		n := int64(binary.LittleEndian.Uint32(b[20:24]))
		if 24+n > int64(len(b)) {
			return errors.New("UDF: allocation extent descriptor overrun")
		}
		ads = b[24 : 24+n]
	}
}

// udfEntry is a parsed (extended) file entry.
type udfEntry struct {
	isDir    bool
	fileType byte
	size     int64
	extents  []Extent
	inline   []byte // data embedded in the ICB (allocation type 3)
	// inlineAt is where that data starts in the image: in the entry's own
	// block, after the entry's fixed part and its extended attributes.
	inlineAt int64
}

func (d *Disc) readUDFEntry(ctx *udfCtx, icb longAD) (*udfEntry, error) {
	var (
		b   []byte
		sec int64
		err error
	)
	// An entry may be replaced by a newer one, through an indirect entry
	// after it (ICB strategy 4096, rewritable media) or in its place.
	for hops := 0; ; hops++ {
		if hops > 16 {
			return nil, errors.New("UDF: too many indirect entries")
		}
		if sec, err = ctx.abs(icb.part, icb.block); err != nil {
			return nil, err
		}
		if b, err = d.sector(sec); err != nil {
			return nil, err
		}
		tag := binary.LittleEndian.Uint16(b[0:2])
		if tag == 259 { // Indirect entry
			icb = readLongAD(b[36:52])
			continue
		}
		if (tag == 261 || tag == 266) && binary.LittleEndian.Uint16(b[16+4:16+6]) == 4096 {
			if s, err := ctx.abs(icb.part, icb.block+1); err == nil {
				if nb, err := d.sector(s); err == nil && binary.LittleEndian.Uint16(nb[0:2]) == 259 {
					if next := readLongAD(nb[36:52]); next.length > 0 {
						icb = next
						continue
					}
				}
			}
		}
		break
	}
	tag := binary.LittleEndian.Uint16(b[0:2])
	var (
		eaLen, adLen uint32
		adStart      int64
	)
	switch tag {
	case 261: // File Entry
		eaLen = binary.LittleEndian.Uint32(b[168:172])
		adLen = binary.LittleEndian.Uint32(b[172:176])
		adStart = 176 + int64(eaLen)
	case 266: // Extended File Entry
		eaLen = binary.LittleEndian.Uint32(b[208:212])
		adLen = binary.LittleEndian.Uint32(b[212:216])
		adStart = 216 + int64(eaLen)
	default:
		return nil, fmt.Errorf("UDF: unexpected tag %d at sector %d", tag, sec)
	}
	fileType := b[16+11]
	flags := binary.LittleEndian.Uint16(b[16+18 : 16+20])
	e := &udfEntry{isDir: fileType == 4, fileType: fileType, size: int64(binary.LittleEndian.Uint64(b[56:64]))}
	if adStart+int64(adLen) > int64(len(b)) {
		return nil, errors.New("UDF: allocation descriptors overrun")
	}
	ads := b[adStart : adStart+int64(adLen)]
	switch flags & 7 {
	case 0, 1, 2: // short_ad, long_ad or ext_ad
		if err := d.udfExtents(ctx, e, ads, flags&7, icb.part); err != nil {
			return nil, err
		}
	case 3: // embedded
		e.inline = append([]byte(nil), ads...)
		e.inlineAt = sec*Sector + adStart
	default:
		return nil, fmt.Errorf("UDF: allocation type %d", flags&7)
	}
	if e.inline == nil {
		e.extents = fitExtents(e.extents, &e.size)
	}
	return e, nil
}

// fitExtents ends a file's extents where its information length does:
// authoring tools may round the last one up to whole blocks. A length the
// extents don't reach is kept (the rest reads as zeros); one that can't be
// (past 2^63) is what the extents hold.
func fitExtents(ext []Extent, size *int64) []Extent {
	var sum int64
	for i, e := range ext {
		if *size >= 0 && sum+e.Length >= *size {
			ext[i].Length = *size - sum
			if ext[i].Length == 0 {
				return ext[:i]
			}
			return ext[:i+1]
		}
		sum += e.Length
	}
	if *size < 0 {
		*size = sum
	}
	return ext
}

func (d *Disc) walkUDFDir(ctx *udfCtx, icb longAD, prefix string, depth int) error {
	if depth > maxUDFDepth {
		return nil
	}
	ent, err := d.readUDFEntry(ctx, icb)
	if err != nil {
		return err
	}
	if ent.size < 0 || ent.size > maxUDFDir {
		return errors.New("UDF: directory too large")
	}
	if err := d.enterDir(int64(icb.part)<<32|int64(icb.block), ent.size); errors.Is(err, errSeen) {
		return nil
	} else if err != nil {
		return err
	}
	var data []byte
	if ent.inline != nil {
		data = ent.inline[:min(int64(len(ent.inline)), ent.size)]
	} else {
		data = make([]byte, ent.size)
		tmp := &File{Size: ent.size, Extents: ent.extents}
		if _, err := d.ReadAtFile(tmp, data, 0); err != nil && !errors.Is(err, io.EOF) {
			return err
		}
	}
	for off := 0; off+38 <= len(data); {
		if binary.LittleEndian.Uint16(data[off:off+2]) != 257 { // FID
			break
		}
		if err := d.nextEntry(); err != nil {
			return err
		}
		chars := data[off+18]
		fidICB := readLongAD(data[off+20 : off+36])
		implLen := int(binary.LittleEndian.Uint16(data[off+36 : off+38]))
		nameLen := int(data[off+19])
		nameOff := off + 38 + implLen
		if nameOff+nameLen > len(data) {
			break
		}
		name := decodeDChars(data[nameOff : nameOff+nameLen])
		total := 38 + implLen + nameLen
		total = (total + 3) &^ 3
		off += total
		if chars&8 != 0 || chars&4 != 0 { // parent or deleted
			continue
		}
		if name == "" {
			continue
		}
		full := prefix + "/" + name
		if chars&2 != 0 { // directory
			d.add(&File{Path: full, IsDir: true})
			err := d.walkUDFDir(ctx, fidICB, full, depth+1)
			if errors.Is(err, errLimit) {
				return err
			} else if err != nil {
				// One unreadable directory doesn't lose the rest of the disc.
				d.udfSkipped++
			}
			continue
		}
		fe, err := d.readUDFEntry(ctx, fidICB)
		if errors.Is(err, errLimit) {
			return err
		} else if err != nil {
			d.udfSkipped++
			continue
		}
		f := &File{Path: full, Size: fe.size, Extents: fe.extents}
		if fe.inline != nil {
			// A small file kept inside its own file entry: its bytes follow the
			// entry's fixed part and extended attributes, in the entry's block.
			// The entry holds what is there, whatever length it claims.
			f.Size = min(max(fe.size, 0), int64(len(fe.inline)))
			f.Extents = nil
			if f.Size > 0 {
				f.Extents = []Extent{{Offset: fe.inlineAt, Length: f.Size}}
			}
		}
		d.add(f)
	}
	return nil
}

// decodeDChars decodes an OSTA compressed unicode string (first byte is the
// compression ID: 8 = latin1, 16 = UTF-16BE).
func decodeDChars(b []byte) string {
	if len(b) == 0 {
		return ""
	}
	switch b[0] {
	case 8:
		return string(b[1:])
	case 16:
		var sb strings.Builder
		for i := 1; i+1 < len(b); i += 2 {
			sb.WriteRune(rune(binary.BigEndian.Uint16(b[i : i+2])))
		}
		return sb.String()
	}
	return string(b)
}

// decodeDString decodes a fixed-length dstring (last byte is the length).
func decodeDString(b []byte) string {
	if len(b) == 0 {
		return ""
	}
	l := int(b[len(b)-1])
	if l == 0 || l > len(b)-1 {
		return ""
	}
	return strings.TrimRight(decodeDChars(b[:l]), "\x00 ")
}
