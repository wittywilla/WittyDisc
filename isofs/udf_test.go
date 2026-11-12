// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors

package isofs

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"strings"
	"testing"
)

// udfDisc builds UDF images the way discs lay them out: an anchor at sector
// 256 naming volume descriptors at 32-35 (primary, partition, logical volume
// with its partition maps, terminator), and one partition from sector
// udfStart. Descriptor tags carry their identifier and no checksum, which
// the reader does not ask for.
type udfDisc struct {
	img  []byte
	maps [][]byte
}

const udfStart = 260 // the partition's first sector

func newUDFDisc(sectors int) *udfDisc { return &udfDisc{img: make([]byte, sectors*Sector)} }

// at is an absolute sector of the image; blk a block of the partition.
func (u *udfDisc) at(sector int64) []byte { return u.img[sector*Sector : (sector+1)*Sector] }
func (u *udfDisc) blk(block int64) []byte { return u.at(udfStart + block) }

// physicalMap adds a type 1 map of partition 0 and returns its reference.
func (u *udfDisc) physicalMap() uint16 {
	u.maps = append(u.maps, []byte{1, 6, 0, 0, 0, 0})
	return uint16(len(u.maps) - 1)
}

// type2Map adds a type 2 map with an identifier, of partition 0.
func (u *udfDisc) type2Map(ident string, fill func(m []byte)) uint16 {
	m := make([]byte, 64)
	m[0], m[1] = 2, 64
	copy(m[5:], ident)
	binary.LittleEndian.PutUint16(m[28:], 0x0250)
	if fill != nil {
		fill(m)
	}
	u.maps = append(u.maps, m)
	return uint16(len(u.maps) - 1)
}

// finish writes the volume descriptors and the anchor; the file set
// descriptor is at block fsd of partition reference part.
func (u *udfDisc) finish(fsd uint32, part uint16) []byte {
	binary.LittleEndian.PutUint16(u.at(32), 1)
	pd := u.at(33)
	binary.LittleEndian.PutUint16(pd, 5)
	binary.LittleEndian.PutUint32(pd[188:], udfStart)
	binary.LittleEndian.PutUint32(pd[192:], uint32(len(u.img)/Sector-udfStart))
	lvd := u.at(34)
	binary.LittleEndian.PutUint16(lvd, 6)
	binary.LittleEndian.PutUint32(lvd[212:], Sector)
	copy(lvd[248:], lad(0, Sector, fsd, part))
	off := 440
	for _, m := range u.maps {
		off += copy(lvd[off:], m)
	}
	binary.LittleEndian.PutUint32(lvd[264:], uint32(off-440))
	binary.LittleEndian.PutUint32(lvd[268:], uint32(len(u.maps)))
	binary.LittleEndian.PutUint16(u.at(35), 8)
	avdp := u.at(256)
	binary.LittleEndian.PutUint16(avdp, 2)
	binary.LittleEndian.PutUint32(avdp[16:], 4*Sector)
	binary.LittleEndian.PutUint32(avdp[20:], 32)
	return u.img
}

// fsd writes a file set descriptor whose root directory's entry is at
// block root of partition reference part.
func fsdAt(b []byte, root uint32, part uint16) {
	binary.LittleEndian.PutUint16(b, 256)
	copy(b[400:], lad(0, Sector, root, part))
}

// Allocation descriptors: type is the top two bits of the length.
func sad(typ, length, block uint32) []byte {
	b := make([]byte, 8)
	binary.LittleEndian.PutUint32(b, typ<<30|length)
	binary.LittleEndian.PutUint32(b[4:], block)
	return b
}

func lad(typ, length, block uint32, part uint16) []byte {
	b := make([]byte, 16)
	binary.LittleEndian.PutUint32(b, typ<<30|length)
	binary.LittleEndian.PutUint32(b[4:], block)
	binary.LittleEndian.PutUint16(b[8:], part)
	return b
}

func ead(typ, length, recorded, block uint32, part uint16) []byte {
	b := make([]byte, 20)
	binary.LittleEndian.PutUint32(b, typ<<30|length)
	binary.LittleEndian.PutUint32(b[4:], recorded)
	binary.LittleEndian.PutUint32(b[8:], length)
	binary.LittleEndian.PutUint32(b[12:], block)
	binary.LittleEndian.PutUint16(b[16:], part)
	return b
}

// udfEntryOf writes a file entry (tag 261) or an extended one (266) whose
// allocation descriptors (adType 0 short, 1 long, 2 extended) are ads.
func udfEntryOf(b []byte, tag uint16, fileType byte, adType uint16, size int64, ads ...[]byte) {
	fixed := 176
	if tag == 266 {
		fixed = 216
	}
	all := bytes.Join(ads, nil)
	binary.LittleEndian.PutUint16(b, tag)
	b[16+11] = fileType
	binary.LittleEndian.PutUint16(b[16+18:], adType)
	binary.LittleEndian.PutUint64(b[56:], uint64(size))
	binary.LittleEndian.PutUint32(b[fixed-4:], uint32(len(all)))
	copy(b[fixed:], all)
}

// udfFIDIn is a file identifier naming an entry in partition reference part.
func udfFIDIn(name string, block uint32, part uint16, dir bool) []byte {
	b := udfFID(name, block, dir)
	binary.LittleEndian.PutUint16(b[28:], part)
	return b
}

// aed writes an allocation extent descriptor: more of a file's descriptors.
func aed(b []byte, ads ...[]byte) {
	all := bytes.Join(ads, nil)
	binary.LittleEndian.PutUint16(b, 258)
	binary.LittleEndian.PutUint32(b[20:], uint32(len(all)))
	copy(b[24:], all)
}

func fill(c byte, n int) []byte { return bytes.Repeat([]byte{c}, n) }

func zeros(n int) []byte { return make([]byte, n) }

func cat(parts ...[]byte) []byte { return bytes.Join(parts, nil) }

// physicalDisc is a disc with one physical map, its file set at block 1 and
// an embedded root directory at block 3 listing one file, F, whose entry is
// at block 10. Data blocks from 20 on are filled with a letter each.
func physicalDisc(entry func(u *udfDisc)) []byte {
	u := newUDFDisc(udfStart + 400)
	u.physicalMap()
	fsdAt(u.blk(1), 3, 0)
	udfEmbedded(u.blk(3), 261, 4, 0, udfFID("F", 10, false))
	for b := int64(20); b < 40; b++ {
		copy(u.blk(b), fill(byte('A'+b-20), Sector))
	}
	entry(u)
	return u.finish(1, 0)
}

func sector(block int64) int64 { return (udfStart + block) * Sector }

// Allocation descriptors of every kind, the extent types, descriptor chains,
// and a size that disagrees with the extents.
func TestUDFAllocation(t *testing.T) {
	for _, tc := range []struct {
		name    string
		entry   func(u *udfDisc)
		size    int64
		content []byte   // nil: not read (lies past the image)
		extents []Extent // nil: not checked
	}{
		{
			name:    "short_ad in a file entry",
			entry:   func(u *udfDisc) { udfEntryOf(u.blk(10), 261, 5, 0, 3000, sad(0, 3000, 20)) },
			size:    3000,
			content: cat(fill('A', Sector), fill('B', 3000-Sector)),
			extents: []Extent{{Offset: sector(20), Length: 3000}},
		},
		{
			name:    "long_ad in an extended file entry",
			entry:   func(u *udfDisc) { udfEntryOf(u.blk(10), 266, 5, 1, 2500, lad(0, 2048, 22, 0), lad(0, 452, 25, 0)) },
			size:    2500,
			content: cat(fill('C', Sector), fill('F', 452)),
			extents: []Extent{{Offset: sector(22), Length: 2048}, {Offset: sector(25), Length: 452}},
		},
		{
			name: "ext_ad, recorded in part",
			entry: func(u *udfDisc) {
				udfEntryOf(u.blk(10), 266, 5, 2, 5000, ead(0, 4096, 2048, 21, 0), ead(0, 904, 904, 23, 0))
			},
			size:    5000,
			content: cat(fill('B', Sector), zeros(Sector), fill('D', 904)),
			extents: []Extent{{Offset: sector(21), Length: 2048}, {Offset: -1, Length: 2048, Zero: true}, {Offset: sector(23), Length: 904}},
		},
		{
			name: "extents not recorded read as zeros",
			entry: func(u *udfDisc) {
				udfEntryOf(u.blk(10), 261, 5, 0, 3*Sector+100,
					sad(0, Sector, 20),  // recorded
					sad(1, Sector, 21),  // allocated, not recorded: the disc's bytes there are not the file's
					sad(2, Sector, 1e9), // neither: its location means nothing
					sad(0, 100, 22))
			},
			size:    3*Sector + 100,
			content: cat(fill('A', Sector), zeros(2*Sector), fill('C', 100)),
			extents: []Extent{{Offset: sector(20), Length: Sector}, {Offset: -1, Length: Sector, Zero: true}, {Offset: -1, Length: Sector, Zero: true}, {Offset: sector(22), Length: 100}},
		},
		{
			name: "descriptors continued in other blocks",
			entry: func(u *udfDisc) {
				udfEntryOf(u.blk(10), 261, 5, 0, 4*Sector, sad(0, Sector, 20), sad(3, Sector, 11))
				aed(u.blk(11), sad(0, Sector, 24), sad(0, Sector, 26), sad(3, Sector, 12))
				aed(u.blk(12), sad(0, Sector, 21))
			},
			size:    4 * Sector,
			content: cat(fill('A', Sector), fill('E', Sector), fill('G', Sector), fill('B', Sector)),
		},
		{
			name: "long_ad descriptors continued",
			entry: func(u *udfDisc) {
				udfEntryOf(u.blk(10), 266, 5, 1, 2*Sector, lad(0, Sector, 29, 0), lad(3, Sector, 11, 0))
				aed(u.blk(11), lad(0, Sector, 28, 0))
			},
			size:    2 * Sector,
			content: cat(fill('J', Sector), fill('I', Sector)),
		},
		{
			name:    "extents shorter than the size: the rest is zeros",
			entry:   func(u *udfDisc) { udfEntryOf(u.blk(10), 261, 5, 0, 3000, sad(0, Sector, 20)) },
			size:    3000,
			content: cat(fill('A', Sector), zeros(3000-Sector)),
			extents: []Extent{{Offset: sector(20), Length: Sector}},
		},
		{
			name:    "extents longer than the size end where it does",
			entry:   func(u *udfDisc) { udfEntryOf(u.blk(10), 261, 5, 0, 2100, sad(0, 2*Sector, 20), sad(0, Sector, 30)) },
			size:    2100,
			content: cat(fill('A', Sector), fill('B', 52)),
			extents: []Extent{{Offset: sector(20), Length: 2100}},
		},
		{
			name: "a stream file of three gigabytes",
			entry: func(u *udfDisc) {
				const most = 0x3ffff800 // the longest extent of whole blocks
				udfEntryOf(u.blk(10), 266, 5, 1, 3*most+192,
					lad(0, most, 1000, 0), lad(0, most, 1000+most/Sector, 0), lad(0, most, 1000+2*most/Sector, 0), lad(0, 192, 20, 0))
			},
			size: 3*0x3ffff800 + 192,
			extents: []Extent{
				{Offset: sector(1000), Length: 0x3ffff800},
				{Offset: sector(1000 + 0x3ffff800/Sector), Length: 0x3ffff800},
				{Offset: sector(1000 + 2*0x3ffff800/Sector), Length: 0x3ffff800},
				{Offset: sector(20), Length: 192},
			},
		},
		{
			name:    "embedded in an extended entry after its attributes",
			entry:   func(u *udfDisc) { udfEmbedded(u.blk(10), 266, 5, 48, []byte("index")) },
			size:    5,
			content: []byte("index"),
			extents: []Extent{{Offset: sector(10) + 216 + 48, Length: 5}},
		},
		{
			name: "a newer entry through an indirect entry (strategy 4096)",
			entry: func(u *udfDisc) {
				udfEntryOf(u.blk(10), 261, 5, 0, 10, sad(0, 10, 20))
				binary.LittleEndian.PutUint16(u.blk(10)[16+4:], 4096)
				binary.LittleEndian.PutUint16(u.blk(11), 259)
				copy(u.blk(11)[36:], lad(0, Sector, 12, 0))
				udfEntryOf(u.blk(12), 261, 5, 0, 10, sad(0, 10, 21))
				binary.LittleEndian.PutUint16(u.blk(12)[16+4:], 4096)
			},
			size:    10,
			content: fill('B', 10),
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			d, err := openBytes(t, physicalDisc(tc.entry))
			if err != nil {
				t.Fatal(err)
			}
			f, ok := d.Find("F")
			if !ok || f.Size != tc.size {
				t.Fatalf("found %v, %+v; want %d bytes", ok, f, tc.size)
			}
			if tc.extents != nil && fmt.Sprint(f.Extents) != fmt.Sprint(tc.extents) {
				t.Errorf("extents %+v, want %+v", f.Extents, tc.extents)
			}
			if tc.content == nil {
				return
			}
			got, err := d.ReadFile("F", 0)
			if err != nil || !bytes.Equal(got, tc.content) {
				t.Errorf("read %d bytes (%v), want %d: %q", len(got), err, len(tc.content), short(got))
			}
			// Any piece reads as the same bytes of the whole.
			for _, at := range []int64{1, Sector - 3, Sector + 7, int64(len(tc.content)) - 5} {
				if at < 0 || at >= int64(len(tc.content)) {
					continue
				}
				part := make([]byte, min(int64(10), int64(len(tc.content))-at))
				if n, err := d.ReadAtFile(f, part, at); n != len(part) || err != nil || !bytes.Equal(part, tc.content[at:at+int64(n)]) {
					t.Errorf("at %d: %q (%d, %v)", at, part[:n], n, err)
				}
			}
		})
	}
}

func short(b []byte) []byte {
	if len(b) > 40 {
		return b[:40]
	}
	return b
}

// A directory kept inside an extended file entry, after attributes, and a
// file kept in a plain one.
func TestUDFEmbeddedDirectoryInExtendedEntry(t *testing.T) {
	u := newUDFDisc(udfStart + 40)
	u.physicalMap()
	fsdAt(u.blk(1), 3, 0)
	udfEmbedded(u.blk(3), 266, 4, 64, cat(udfFID("BDMV", 4, true)))
	udfEmbedded(u.blk(4), 266, 4, 12, cat(udfFID("INDEX.BDMV", 5, false), udfFID("MOVIEOBJECT.BDMV", 6, false)))
	udfEmbedded(u.blk(5), 261, 5, 0, []byte("INDX0200"))
	udfEmbedded(u.blk(6), 266, 5, 4, []byte("MOBJ0200"))
	d, err := openBytes(t, u.finish(1, 0))
	if err != nil {
		t.Fatal(err)
	}
	for name, want := range map[string]string{"BDMV/INDEX.BDMV": "INDX0200", "BDMV/MOVIEOBJECT.BDMV": "MOBJ0200"} {
		if got, err := d.ReadFile(name, 0); err != nil || string(got) != want {
			t.Errorf("%s: %q (%v)", name, got, err)
		}
	}
}

// metadataDisc is a UDF 2.50 disc as a Blu-ray has it: a physical map and a
// metadata map, the metadata file at physical block 0 (in two extents, so
// that one directory lies across both) and its mirror at block 1. In the
// metadata partition: the file set at 0, the root directory at 1 (its data
// in blocks 2 and 3, sixty stream files and BDMV), a stream file's entry at
// 4, and BDMV, an embedded directory, at 5. damage says what to break.
func metadataDisc(damage string) []byte {
	u := newUDFDisc(udfStart + 220)
	phys := u.physicalMap()
	meta := u.type2Map("*UDF Metadata Partition", func(m []byte) {
		binary.LittleEndian.PutUint32(m[40:], 0)
		binary.LittleEndian.PutUint32(m[44:], 1)
		binary.LittleEndian.PutUint32(m[48:], 0xffffffff)
	})
	// The metadata file: blocks 0-2 at 100, 3-5 at 120. Its mirror: 0-5 at 150.
	udfEntryOf(u.blk(0), 266, 250, 0, 6*Sector, sad(0, 3*Sector, 100), sad(0, 3*Sector, 120))
	udfEntryOf(u.blk(1), 266, 251, 0, 6*Sector, sad(0, 6*Sector, 150))
	main := func(k int64) []byte {
		if k < 3 {
			return u.blk(100 + k)
		}
		return u.blk(120 + k - 3)
	}
	put := func(k int64, write func(b []byte)) {
		write(main(k))
		write(u.blk(150 + k))
	}
	var dir []byte
	for i := 0; i < 60; i++ {
		dir = append(dir, udfFIDIn(fmt.Sprintf("%05d.M2TS", i), 4, meta, false)...)
	}
	dir = append(dir, udfFIDIn("BDMV", 5, meta, true)...)
	put(0, func(b []byte) { fsdAt(b, 1, meta) })
	put(1, func(b []byte) { udfEntryOf(b, 266, 4, 1, int64(len(dir)), lad(0, uint32(len(dir)), 2, meta)) })
	put(2, func(b []byte) { copy(b, dir) })
	put(3, func(b []byte) { copy(b, dir[Sector:]) })
	put(4, func(b []byte) { udfEntryOf(b, 266, 5, 1, 192, lad(0, 192, 200, phys)) })
	put(5, func(b []byte) { udfEmbedded(b, 266, 4, 0, udfFIDIn("INDEX.BDMV", 4, meta, false)) })
	copy(u.blk(200), fill('G', 192))
	switch damage {
	case "metadata file entry":
		clear(u.blk(0))
	case "metadata file's blocks":
		for k := int64(0); k < 6; k++ {
			clear(main(k))
		}
	case "a directory's entry":
		clear(main(5))
	case "both copies":
		clear(u.blk(0))
		clear(u.blk(1))
	}
	return u.finish(0, meta)
}

// A metadata partition is read through its file, and through the mirror of
// it when the main copy can't be read or leads nowhere (UDF 2.50 2.2.13).
func TestUDFMetadataPartition(t *testing.T) {
	for _, damage := range []string{"intact", "metadata file entry", "metadata file's blocks", "a directory's entry", "both copies"} {
		t.Run(damage, func(t *testing.T) {
			d, err := openBytes(t, metadataDisc(damage))
			if damage == "both copies" {
				if err == nil || !strings.Contains(err.Error(), "metadata partition") {
					t.Fatalf("opened with both copies broken: %v", err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if n := len(d.Files()); n != 62 {
				t.Errorf("%d files, want 62", n)
			}
			for _, name := range []string{"00000.M2TS", "00059.M2TS", "BDMV/INDEX.BDMV"} {
				if got, err := d.ReadFile(name, 0); err != nil || !bytes.Equal(got, fill('G', 192)) {
					t.Errorf("%s: %q (%v)", name, short(got), err)
				}
			}
		})
	}
}

// sparableDisc is a rewritable disc: a sparable partition of 32-block
// packets whose packet at block 32 moved to sector 400, and the sparing
// table's two copies at sectors 40 and 44. File A's entry lies in the moved
// packet; file B's data runs from the moved packet into the next one.
func sparableDisc(tables string) []byte {
	u := newUDFDisc(450)
	u.type2Map("*UDF Sparable Partition", func(m []byte) {
		binary.LittleEndian.PutUint16(m[40:], 32)
		m[42] = 2
		binary.LittleEndian.PutUint32(m[44:], Sector)
		binary.LittleEndian.PutUint32(m[48:], 40)
		binary.LittleEndian.PutUint32(m[52:], 44)
	})
	table := func(b []byte) {
		copy(b[17:], "*UDF Sparing Table")
		binary.LittleEndian.PutUint16(b[48:], 3)
		binary.LittleEndian.PutUint32(b[56:], 32)
		binary.LittleEndian.PutUint32(b[60:], 400)
		binary.LittleEndian.PutUint32(b[64:], 0xffffffff) // a free entry
		binary.LittleEndian.PutUint32(b[72:], 0xfffffff0) // a defective one
	}
	switch tables {
	case "both":
		table(u.at(40))
		table(u.at(44))
	case "second":
		table(u.at(44))
	}
	moved := func(block int64) []byte { return u.at(400 + block - 32) }
	fsdAt(u.blk(1), 3, 0)
	udfEmbedded(u.blk(3), 261, 4, 0, cat(udfFID("A", 40, false), udfFID("B", 41, false)))
	udfEmbedded(moved(40), 261, 5, 0, []byte("spared entry"))
	udfEmbedded(u.blk(40), 261, 5, 0, []byte("stale entry!"))
	udfEntryOf(moved(41), 261, 5, 0, 3*Sector, sad(0, 3*Sector, 62))
	copy(moved(62), fill('x', Sector))
	copy(moved(63), fill('y', Sector))
	copy(u.blk(64), fill('z', Sector))
	copy(u.blk(62), fill('!', 2*Sector))
	return u.finish(1, 0)
}

// A sparable partition's blocks are found through its sparing table.
func TestUDFSparablePartition(t *testing.T) {
	for _, tables := range []string{"both", "second", "none"} {
		t.Run(tables, func(t *testing.T) {
			d, err := openBytes(t, sparableDisc(tables))
			if tables == "none" {
				if err == nil || !strings.Contains(err.Error(), "sparing table") {
					t.Fatalf("opened without a sparing table: %v", err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if got, err := d.ReadFile("A", 0); err != nil || string(got) != "spared entry" {
				t.Errorf("A: %q (%v)", got, err)
			}
			want := cat(fill('x', Sector), fill('y', Sector), fill('z', Sector))
			if got, err := d.ReadFile("B", 0); err != nil || !bytes.Equal(got, want) {
				t.Errorf("B: %q (%v)", short(got), err)
			}
			f, _ := d.Find("B")
			if wantExt := []Extent{{Offset: (400 + 30) * Sector, Length: 2 * Sector}, {Offset: sector(64), Length: Sector}}; fmt.Sprint(f.Extents) != fmt.Sprint(wantExt) {
				t.Errorf("B lies at %+v, want %+v", f.Extents, wantExt)
			}
		})
	}
}

// virtualDisc is an incrementally written disc: a physical map and a
// virtual one, whose blocks 0-2 are physical blocks 50, 51 and 60, and the
// virtual allocation table in the image's last sector, in the form of UDF
// 2.00 or 1.50 (or missing).
func virtualDisc(vat string) []byte {
	u := newUDFDisc(udfStart + 100)
	phys := u.physicalMap()
	virt := u.type2Map("*UDF Virtual Partition", nil)
	fsdAt(u.blk(50), 1, virt)
	udfEmbedded(u.blk(51), 266, 4, 0, cat(udfFIDIn("VIDEO_TS", 2, virt, true)))
	udfEmbedded(u.blk(60), 266, 4, 0, cat(udfFIDIn("VIDEO_TS.IFO", 3, virt, false)))
	udfEntryOf(u.blk(61), 266, 5, 1, 12, lad(0, 12, 70, phys))
	copy(u.blk(70), "DVDVIDEO-VMG")
	table := []uint32{50, 51, 60, 61, 0xffffffff}
	last := u.at(int64(len(u.img)/Sector - 1))
	switch vat {
	case "2.00":
		data := make([]byte, 152)
		binary.LittleEndian.PutUint16(data, 152)
		for _, b := range table {
			data = binary.LittleEndian.AppendUint32(data, b)
		}
		udfEmbedded(last, 266, 248, 0, data)
	case "1.50":
		var data []byte
		for _, b := range table {
			data = binary.LittleEndian.AppendUint32(data, b)
		}
		id := make([]byte, 36)
		copy(id[1:], "*UDF Virtual Alloc Tbl")
		udfEmbedded(last, 261, 0, 0, append(data, id...))
	}
	return u.finish(0, virt)
}

// A virtual partition's blocks are found through the virtual allocation
// table; without one the disc is refused rather than misread.
func TestUDFVirtualPartition(t *testing.T) {
	for _, vat := range []string{"2.00", "1.50", "none"} {
		t.Run(vat, func(t *testing.T) {
			d, err := openBytes(t, virtualDisc(vat))
			if vat == "none" {
				if err == nil || !strings.Contains(err.Error(), "virtual allocation table") {
					t.Fatalf("opened without a VAT: %v", err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if got, err := d.ReadFile("VIDEO_TS/VIDEO_TS.IFO", 0); err != nil || string(got) != "DVDVIDEO-VMG" {
				t.Errorf("read %q (%v)", got, err)
			}
		})
	}
}

// A partition map this reader doesn't know is refused, by name, when used.
func TestUDFUnknownPartitionMap(t *testing.T) {
	u := newUDFDisc(udfStart + 10)
	ref := u.type2Map("*UDF Something Else", nil)
	fsdAt(u.blk(1), 3, ref)
	_, err := openBytes(t, u.finish(1, ref))
	if err == nil || !strings.Contains(err.Error(), "*UDF Something Else") {
		t.Fatalf("got %v", err)
	}
}

// A Blu-ray's STREAM and CLIPINF folders hold thousands of files, and
// directories may nest deeper than a video disc's.
func TestUDFManyFilesAndDeepFolders(t *testing.T) {
	const clips = 6000
	u := newUDFDisc(udfStart + 800)
	u.physicalMap()
	fsdAt(u.blk(1), 3, 0)
	udfEmbedded(u.blk(3), 261, 4, 0, cat(udfFID("STREAM", 4, true), udfFID("CLIPINF", 5, true), udfFID("D", 500, true)))
	udfEmbedded(u.blk(9), 261, 5, 0, []byte("clip"))
	next := int64(10)
	for i, ext := range []string{"M2TS", "CLPI"} {
		var dir []byte
		for n := 0; n < clips; n++ {
			dir = append(dir, udfFID(fmt.Sprintf("%05d.%s", n, ext), 9, false)...)
		}
		udfEntryOf(u.blk(int64(4+i)), 261, 4, 0, int64(len(dir)), sad(0, uint32(len(dir)), uint32(next)))
		copy(u.img[sector(next):], dir)
		next += int64(len(dir)+Sector-1) / Sector
	}
	for level := int64(0); level < 30; level++ {
		udfEmbedded(u.blk(500+level), 261, 4, 0, udfFID("D", uint32(501+level), true))
	}
	udfEmbedded(u.blk(530), 261, 4, 0, udfFID("DEEP.TXT", 9, false))
	if next > 500 {
		t.Fatalf("directories reach block %d", next)
	}
	d, err := openBytes(t, u.finish(1, 0))
	if err != nil {
		t.Fatal(err)
	}
	if n := len(d.Files()); n != 2*clips+3+31 {
		t.Errorf("%d files, want %d", n, 2*clips+3+31)
	}
	for _, name := range []string{"STREAM/05999.M2TS", "CLIPINF/00000.CLPI", strings.Repeat("D/", 31) + "DEEP.TXT"} {
		if got, err := d.ReadFile(name, 0); err != nil || string(got) != "clip" {
			t.Errorf("%s: %q (%v)", name, got, err)
		}
	}
}

// A file whose extents run past the end of a truncated image reads what
// there is and says it ended, without taking the next extent's bytes for it.
func TestUDFTruncatedImage(t *testing.T) {
	img := physicalDisc(func(u *udfDisc) {
		udfEntryOf(u.blk(10), 261, 5, 0, 3*Sector, sad(0, Sector, 399), sad(0, 2*Sector, 20))
	})
	img = img[:len(img)-Sector/2]
	d, err := openBytes(t, img)
	if err != nil {
		t.Fatal(err)
	}
	got, err := d.ReadFile("F", 0)
	if err == nil || len(got) != Sector/2 {
		t.Errorf("read %d bytes (%v), want %d and an error", len(got), err, Sector/2)
	}
}
