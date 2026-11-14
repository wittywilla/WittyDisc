// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// Settings, DVDs and Blu-rays (web.settings: discs): how discs play for everyone on this server.
// These are the server's own settings, which its disc sessions read; WittyDisc draws them. Each
// disc can change some of them in its own Disc settings.
import { useEffect, useState } from 'react'
import { api } from '@wms/app/api'
import { LoadError } from '@wms/app/components/common'
import { HelpLink } from '@wms/app/components/HelpLink'
import { PageHead, Row, SaveBar, Section, Switch, useServerSettings } from '@wms/app/pages/settings/ui'

export default function DiscSettings() {
  const st = useServerSettings()
  const { s, set, on } = st
  if (!s) return st.failed ? <LoadError what="This page" onRetry={st.retry} /> : null
  const fx = on('insertFx')
  return (
    <>
      <PageHead title="DVDs and Blu-rays" desc="Discs play with their real menus, like a disc player. Each disc can change some of these in its own Disc settings." />
      <Section title="Playing discs">
        <Row label="When a disc is inserted">
          <select className="select" value={s.dvdStart || 'menu'} onChange={(e) => set('dvdStart', e.target.value)}>
            <option value="menu">Start with the disc menu</option><option value="title">Skip menus, play the movie</option>
          </select>
        </Row>
        <Row label="Disc insert animation" desc="A tray slides in when a DVD or Blu-ray starts.">
          <Switch label="Disc insert animation" checked={fx} onChange={(v) => set('insertFx', v ? '1' : '0')} />
        </Row>
        <Row label="Drive sounds" desc="The tray motor and the disc spinning up, with the animation." dim={!fx}>
          <Switch label="Drive sounds" checked={on('insertSound')} disabled={!fx} onChange={(v) => set('insertSound', v ? '1' : '0')} />
        </Row>
        <Row label="Preferred languages" desc="Two-letter codes such as en, nl or fr. Discs that offer them start in these languages." stack>
          <div className="set-trio">
            <label>Menus<input className="input" value={s.menuLanguage || ''} onChange={(e) => set('menuLanguage', e.target.value)} placeholder="en" maxLength={3} /></label>
            <label>Audio<input className="input" value={s.audioLanguage || ''} onChange={(e) => set('audioLanguage', e.target.value)} placeholder="en" maxLength={3} /></label>
            <label>Subtitles<input className="input" value={s.subtitleLanguage || ''} onChange={(e) => set('subtitleLanguage', e.target.value)} placeholder="none" maxLength={3} /></label>
          </div>
        </Row>
        <Row label="Low-power mode for discs" desc="Easier on small computers such as a Raspberry Pi: the menus and titles of DVDs and Blu-rays are converted faster, at a small cost in quality.">
          <Switch label="Low-power mode for discs" checked={s.lowPower === '1'} onChange={(v) => set('lowPower', v ? '1' : '0')} />
        </Row>
        <BDJRows s={s} set={set} dirty={st.dirty} />
        <SecondOpinionRow s={s} set={set} dirty={st.dirty} />
        <Row label="DVD region" desc="1 to 8. Empty plays each disc as its own region.">
          <input className="input" inputMode="numeric" aria-label="DVD region" value={s.dvdRegion || ''} onChange={(e) => set('dvdRegion', e.target.value)} />
        </Row>
        <Row label="Blu-ray region" desc="A disc for another region shows its own message instead of the movie, so pick the region your discs are from.">
          <select className="select" aria-label="Blu-ray region" value={s.blurayRegion || '1'} onChange={(e) => set('blurayRegion', e.target.value)}>
            <option value="1">A: Americas, East and South-East Asia</option>
            <option value="2">B: Europe, Africa, Oceania, Middle East</option>
            <option value="4">C: Central and South Asia, Russia, China</option>
          </select>
        </Row>
        <Row label="Parental limits" desc="Discs with parental versions use these to choose which version plays. Empty means no limit. These are the disc’s own checks, not a lock on the server: use profiles to limit what people can open." stack>
          <div className="set-trio">
            <label>DVD level, 1 to 8<input className="input" inputMode="numeric" value={s.dvdParental || ''} onChange={(e) => set('dvdParental', e.target.value)} /></label>
            <label>Blu-ray viewer’s age<input className="input" inputMode="numeric" value={s.blurayAge || ''} onChange={(e) => set('blurayAge', e.target.value)} /></label>
            <label>Country, two letters<input className="input" maxLength={2} value={s.discCountry || ''} onChange={(e) => set('discCountry', e.target.value)} placeholder="US" /></label>
          </div>
        </Row>
      </Section>
      <SaveBar {...st} />
    </>
  )
}

// BD-J: Blu-ray menus written in Java. Java is the server owner's to install,
// and turning this on runs a disc's code, in a sandbox, so it starts off.
function BDJRows({ s, set, dirty }: { s: Record<string, string>; set: (k: string, v: string) => void; dirty: boolean }) {
  const [status, setStatus] = useState<{ version?: string; path?: string; error?: string; configured?: boolean } | null>(null)
  useEffect(() => { if (!dirty) api.get<{ version?: string; path?: string; error?: string; configured?: boolean }>('/bdj/status').then(setStatus).catch(() => setStatus(null)) }, [dirty])
  return (
    <>
      <Row label="Run Blu-ray Java menus (BD-J)" desc={<>Many commercial Blu-rays write their menus in Java (<HelpLink to="bluray#bd-j-java-menus">more about this</HelpLink>). To show them, install any Java 8 or newer on this server, for example Eclipse Temurin, a free OpenJDK build. It isn’t included. A disc’s Java code runs in its own process with no network and no access to your files outside the disc, but it’s still code from the disc, so this is off until you turn it on. With it off, these discs play their main feature directly.{status && <><br />{status.version ? `Java ${status.version} found: ${status.path}` : status.error ? `Java not usable: ${status.error}` : `Java found: ${status.path}. It’s tried when this is on.`}</>}</>}>
        <Switch label="Run Blu-ray Java menus" checked={s.bdjEnabled === '1'} onChange={(v) => set('bdjEnabled', v ? '1' : '0')} />
      </Row>
      <Row label="Java location" desc={<>{status?.configured ? 'Named in the server’s config file.' : 'Found by itself.'} To use another Java, name its folder as <code>javaPath</code> in the server’s config file, or with <code>WMS_JAVA</code>. It can’t be changed from here, so that a web account can’t choose what the server runs.</>} stack>
        <div className="input mono" role="status">{status?.path || 'None found'}</div>
      </Row>
    </>
  )
}

// A second opinion on which playlist is a Blu-ray's film, from a libbluray the server's
// owner installed. WittyBluray's own reading decides; libbluray only compares, on request,
// for unencrypted discs. It is a library from outside the project reading a disc's files, so
// it starts off, and the row says whether one was found.
function SecondOpinionRow({ s, set, dirty }: { s: Record<string, string>; set: (k: string, v: string) => void; dirty: boolean }) {
  const [cap, setCap] = useState<{ libbluray?: { available: boolean; version?: string; reason?: string }; libblurayPath?: string } | null>(null)
  useEffect(() => { if (!dirty) api.get<typeof cap>('/modules/wittybluray/libbluray').then(setCap).catch(() => setCap(null)) }, [dirty])
  const lb = cap?.libbluray
  return (
    <Row label="Ask libbluray for a second opinion" desc={<>On a Blu-ray’s page, an admin can have a libbluray installed on this server compare its reading of the disc with WittyBluray’s pick of the film (<HelpLink to="bluray#a-second-opinion-from-libbluray">more about this</HelpLink>). It isn’t included, nothing is decrypted, and encrypted discs are never handed to it.{cap && <><br />{lb?.available ? `libbluray ${lb.version || ''} found${cap.libblurayPath ? `: ${cap.libblurayPath}` : ''}` : `No libbluray to ask: ${shortReason(lb?.reason)}.`}</>}</>}>
      <Switch label="Ask libbluray for a second opinion" checked={s.blurayLibbluray === '1'} onChange={(v) => set('blurayLibbluray', v ? '1' : '0')}
        disabled={!!cap && !lb?.available && s.blurayLibbluray !== '1'} />
    </Row>
  )
}

// shortReason is the first clause of why no libbluray can be asked: the list of every file
// name tried is for the server's log, not for Settings.
function shortReason(reason?: string): string {
  const r = (reason || 'none was found on this server').split(' (')[0].replace(/[.\s]+$/, '')
  return r.length > 160 ? r.slice(0, 157) + '…' : r
}
