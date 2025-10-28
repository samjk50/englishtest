// app/api/cert/[id]/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import QRCode from 'qrcode';
import React from 'react';
import { prisma } from '@/lib/prisma';
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  renderToStream,
  Font,
} from '@react-pdf/renderer';
import { Readable } from 'stream';

// ───────── helpers ─────────

async function sessionFromCookies() {
  const jar = await cookies();
  const t = jar.get('access_token')?.value;
  if (!t) return null;
  try {
    return jwt.verify(
      t,
      process.env.ACCESS_TOKEN_SECRET ||
        process.env.JWT_ACCESS_SECRET ||
        'devsecret_change_me'
    );
  } catch {
    return null;
  }
}

function placeholderLogoDataUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="120">
    <rect width="100%" height="100%" fill="#1A2D5A"/>
    <g>
      <rect x="170" y="24" width="80" height="60" rx="8" fill="#fff"/>
      <text x="210" y="60" text-anchor="middle" font-family="Helvetica, Arial" font-size="14" fill="#1A2D5A" font-weight="bold">E P</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function resolveLogoUrlAbsolute(baseUrl) {
  const fromEnv = process.env.CERT_LOGO_URL;
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) return fromEnv;
  if (baseUrl) return `${baseUrl.replace(/\/$/, '')}/cert/logo.png`;
  return placeholderLogoDataUrl();
}
function resolveArrowUrlAbsolute(baseUrl) {
  const fromEnv = process.env.CERT_LOGO_URL;
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) return fromEnv;
  if (baseUrl) return `${baseUrl.replace(/\/$/, '')}/cert/arrow.png`;
  return placeholderLogoDataUrl();
}

function levelLabel(code) {
  switch (code) {
    case 'A1': return 'Beginner';
    case 'A2': return 'Elementary';
    case 'B1': return 'Intermediate';
    case 'B2': return 'Upper Intermediate';
    case 'C1': return 'Advanced';
    case 'C2': return 'Proficiency';
    default: return '';
  }
}

function formatDate(isoOrDate) {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ───────── styles tuned to fit on one A4 page ─────────
// NOTE: We set Lato as the default font family at the page level.

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    color: '#2A2F45',
    fontFamily: 'Lato',
  },

  header: {
    backgroundColor: '#1A2D5A',
    paddingTop: 14,
    paddingBottom: 10,      // tighter
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    backgroundColor: '#FFFFFF',
    padding: 5,
    borderRadius: 2,
  },
  logo: { width: 30, height: 30, },
  platform: { marginTop: 6, fontSize: 11, fontWeight: 700, color: '#FFFFFF' },

  content: {
    paddingTop: 10,
    paddingBottom: 18,     // keep overall height in check
    paddingHorizontal: 36, // ≈ 12–13mm
  },

  titleWrap: { alignItems: 'center', marginTop: 8, marginBottom: 4 },
  h1: { fontSize: 26, fontWeight: 700, color: '#243E76', marginBottom: 2 },
  subtitle: { fontSize: 9.5, color: '#000' },

  rule: { height: 1.5, backgroundColor: '#EDC55D', marginVertical: 12 },

  lead: { textAlign: 'center', color: '#8B92A0', fontSize: 10, marginTop: 10, marginBottom: 4 },
  nameWrap: {
    marginTop: 7,     // ↑ more top margin
    marginBottom: 8,  // ↑ more bottom margin
    alignItems: 'center',
  },
  name: {
    textAlign: 'center',
    fontSize: 19,
    fontWeight: 700,
    color: '#2F487D',

    // Thick underline via border (works in react-pdf)
    paddingBottom: 2,               // small gap between text and line
    borderBottomWidth: 2,           // ← increase for thicker line
    borderBottomColor: '#EDC55D',
    alignSelf: 'center',            // underline width = text width
  },
  descWrap: {
    width: 380,          // your requested width
    alignSelf: 'center', // centers within the page/content
  },
  desc: {
    textAlign: 'center',
    color: '#898A94',
    fontSize: 10,
    lineHeight: 1.4,
    fontWeight: 400,
  },
  highlight: { color: '#FBCD63', fontWeight: 900 },

  bold: { fontWeight: 700 },

  panel: {
    backgroundColor: '#F4F6F8',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6,
    paddingVertical: 15, paddingHorizontal: 14, marginTop: 15,
  },
  levelTitle: { textAlign: 'center', color: '#5D6F97', fontSize: 11, fontWeight: 700, marginBottom: 15 },

  ladder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  arrow: { fontSize: 10, color: 'black', marginHorizontal: 4 },
  step: {
     borderRadius: 2,
    width: 80, height: 70, alignItems: 'center', justifyContent: 'center', padding: 4,
  },
  stepActive: { backgroundColor: '#FAC338', borderColor: '#FAC338' },
  stepCode: { fontWeight: 900, fontSize: 12, color: '#89909E' },
  stepCodeActive: { color: '#47433E' },
  stepLabel: { fontSize: 8.5, color: '#A8ADB9', textAlign:"center" },
  stepLabelActive: { color: '#5B533D', fontWeight: 700, textAlign:"center" },

  bullet: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 10,
  },
  pill: {
    alignSelf: 'flex-start', backgroundColor: '#FAC137', color: '#75663C',
    borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8,
    fontSize: 9, fontWeight: 700, marginBottom: 6,
  },

  leveldescription:{
    fontSize:10,
    lineHeight:1,
    fontStyle:"italic"
  },

  detailsPanel: {
    backgroundColor: '#FAFBFB',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6,
    paddingVertical: 12, paddingHorizontal: 14, marginTop: 10,
  },
  detailsTitle: { fontSize: 11, fontWeight: 600, color: '#4D638F', marginBottom: 8 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  box: { width: '48%', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 4, marginBottom: 6 },
  metaLabel: { fontSize: 8.5, color: '#989EAF', textTransform: 'uppercase', marginBottom: 1 },
  metaValue: { fontSize: 9.5, color: '#555862' },

  verifyRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingTop: 14, paddingHorizontal: 16,
  },
  verifyLeft: { flex: 1, paddingRight: 12 },
  verifyTitle: { fontSize: 10.5, color: '#556A94', marginBottom: 6 },
  verifyText: { fontSize: 9.5, color: '#6B7280', lineHeight: 1.5 },
  verifyUrl: { fontSize: 9.5, fontFamily: 'Lato', color: '#FACD6A', marginTop: 4, wordBreak: 'break-all' },

  qrWrap: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 5 },
  qr: { width: 96, height: 96, objectFit: 'contain' },

  bottomRule: { height: 4, backgroundColor: '#847446', marginTop: 16 }, // smaller to avoid spill

});

// ───────── PDF component ─────────

function CertificatePDF({
  platform, logoUrl, user, level, ladder, details, verifyUrl, qrDataUrl, arrowUrl
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.header} wrap={false}>
          {logoUrl ? (
            <View style={styles.logoBox}>
              <Image style={styles.logo} src={logoUrl} />
            </View>
          ) : null}
          <Text style={styles.platform}>{platform}</Text>
        </View>

        <View style={styles.content}>
          {/* Title */}
          <View style={styles.titleWrap} wrap={false}>
            <Text style={styles.h1}>CERTIFICATE</Text>
            <Text style={styles.subtitle}>of English Proficiency</Text>
          </View>
          <View style={styles.rule} />

          {/* Lead + Name + Intro */}
          <Text style={styles.lead}>This is to certify that</Text>
          <View style={styles.nameWrap}>
            <Text style={styles.name}>{user.name}</Text>
          </View>
          <View style={styles.descWrap}>
            <Text style={styles.desc}>
              has successfully completed the English Proficiency Test on platform.com and has
              demonstrated the <Text style={styles.highlight}>{level}</Text> level of English in accordance with the Common European
              Framework of <Text style={styles.bold}>Reference for Languages (CEFR)</Text> .
            </Text>
          </View>

          {/* Level panel */}
          <View style={styles.panel} wrap={false}>
            <Text style={styles.levelTitle}>Level Achieved</Text>
            <View style={styles.ladder}>
              {ladder.map((code, i) => {
                const active = code === level;
                return (
                  <React.Fragment key={code}>
                    <View style={[styles.step, active && styles.stepActive]}>
                      <Text style={[styles.stepCode, active && styles.stepCodeActive]}>{code}</Text>
                      <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>
                        {levelLabel(code)}
                      </Text>
                    </View>
                    {i < ladder.length - 1 ? (
                      <Text style={styles.arrow}>
                        {arrowUrl ? (
                          <View>
                            <Image src={arrowUrl} />
                          </View>
                        ) : null}
                      </Text>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </View>

            <View style={styles.bullet}>
              <Text style={styles.pill}>{level} — {levelLabel(level)}</Text>
              <Text style={styles.leveldescription}>"{details.descriptor}"</Text>
            </View>
          </View>

          {/* Details */}
          <View style={styles.detailsPanel} wrap={false}>
            <Text style={styles.detailsTitle}>Certificate Details</Text>
            <View style={styles.grid}>
              <View style={styles.box}>
                <Text style={styles.metaLabel}>Certificate ID</Text>
                <Text style={styles.metaValue}>{details.certificateId}</Text>
              </View>
              <View style={styles.box}>
                <Text style={styles.metaLabel}>Attempt ID</Text>
                <Text style={styles.metaValue}>{details.attemptId}</Text>
              </View>
              <View style={styles.box}>
                <Text style={styles.metaLabel}>Date of Issue</Text>
                <Text style={styles.metaValue}>{formatDate(details.issuedAt)}</Text>
              </View>
              <View style={styles.box}>
                <Text style={styles.metaLabel}>Region</Text>
                <Text style={styles.metaValue}>{details.region}</Text>
              </View>
            </View>
          </View>

          {/* Verification */}
          <View style={styles.verifyRow} wrap={false}>
            <View style={styles.verifyLeft}>
              <Text style={styles.verifyTitle}>Verification</Text>
              <Text style={styles.verifyText}>
                To verify the authenticity of this certificate, scan the QR code or visit:
              </Text>
              <Text style={styles.verifyUrl}>{verifyUrl}</Text>
              <Text
                style={{ color: '#A2A6B3', fontSize: 9, marginTop: 6, fontStyle: 'italic', maxWidth: 350 }}
              >
                This certificate is digitally issued and verified by English Proficiency Platform
                Assessment System; no manual signature required.
              </Text>
            </View>
            <View style={styles.qrWrap}>
              <Image style={styles.qr} src={qrDataUrl} />
            </View>
          </View>

          <View style={styles.bottomRule} wrap={false} />
        </View>
      </Page>
    </Document>
  );
}

// ───────── route ─────────

export async function GET(_req, context) {
  try {
    const { id } = await context.params;

    const s = await sessionFromCookies();
    if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const attempt = await prisma.attempt.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!attempt || (s.role !== 'ADMIN' && attempt.userId !== s.sub)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (attempt.status !== 'SUBMITTED') {
      return NextResponse.json({ error: 'Attempt not submitted' }, { status: 409 });
    }

    // ensure issuance fields once
    let { certificateId, issuedAt, verifySlug, region } = attempt;
    if (!certificateId || !issuedAt || !verifySlug) {
      certificateId = `T-${String(Math.floor(Math.random() * 1_000_0000)).padStart(7, '0')}`;
      verifySlug = crypto.randomUUID();
      issuedAt = new Date();
      await prisma.attempt.update({
        where: { id },
        data: { certificateId, verifySlug, issuedAt },
      });
    }
    region = region || 'European Union';

    const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const verifyUrl = `${base.replace(/\/$/, '')}/verify/${verifySlug}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, scale: 5 }); // slightly smaller

    const logoUrl = resolveLogoUrlAbsolute(base);
    const arrowUrl = resolveArrowUrlAbsolute(base);

    const displayName = (attempt.user.fullName || '')
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    const level = attempt.level || 'A1';

    const descriptorMap = {
      A1: 'Can understand and use familiar everyday expressions and very basic phrases. Can introduce themselves and others and ask and answer simple questions about personal details (e.g., where they live, people they know, things they have). Can interact in a simple way if the other person talks slowly and clearly.',
      A2: 'Can understand frequently used expressions related to areas of most immediate relevance (e.g., personal and family information, shopping, local geography, employment). Can communicate in simple and routine tasks requiring a simple and direct exchange of information. Can describe in simple terms aspects of their background, immediate environment and matters in areas of immediate need.',
      B1: 'Can understand the main points of clear standard input on familiar matters such as work, school, leisure, etc. Can deal with most situations likely to arise while travelling. Can produce simple connected text on topics which are familiar or of personal interest. Can describe experiences, events, dreams, hopes and ambitions and briefly give reasons and explanations for opinions and plans.',
      B2: 'Can understand the main ideas of complex text on both concrete and abstract topics, including technical discussions in their field of specialisation. Can interact with a degree of fluency and spontaneity that makes regular interaction with native speakers quite possible without strain for either party. Can produce clear, detailed text on a wide range of subjects and explain a viewpoint on a topical issue giving the advantages and disadvantages of various options.',
      C1: 'Can understand a wide range of demanding, longer texts, and recognise implicit meaning. Can express themselves fluently and spontaneously without much obvious searching for expressions. Can use language flexibly and effectively for social, academic and professional purposes. Can produce clear, well-structured, detailed text on complex subjects, showing controlled use of organisational patterns, connectors and cohesive devices.',
      C2: 'Can understand with ease virtually everything heard or read. Can summarise information from different spoken and written sources, reconstructing arguments and accounts in a coherent presentation. Can express themselves spontaneously, very fluently and precisely, differentiating finer shades of meaning even in more complex situations.',
    };

    // --- Register Lato for react-pdf (absolute URLs for Node runtime)
    // Place the font files under /public/fonts:
    // - /public/fonts/Lato-Regular.ttf
    // - /public/fonts/Lato-Italic.ttf
    // - /public/fonts/Lato-Bold.ttf
    // - /public/fonts/Lato-BoldItalic.ttf
    // - /public/fonts/Lato-Light.ttf   (optional)
    // - /public/fonts/Lato-Black.ttf   (optional)
    Font.register({
      family: 'Lato',
      fonts: [
        { src: `${base}/fonts/Lato-Regular.ttf`, fontWeight: 'normal', fontStyle: 'normal' },
        { src: `${base}/fonts/Lato-Italic.ttf`,  fontWeight: 'normal', fontStyle: 'italic' },
        { src: `${base}/fonts/Lato-Bold.ttf`,    fontWeight: 'bold',   fontStyle: 'normal' },
        { src: `${base}/fonts/Lato-BoldItalic.ttf`, fontWeight: 'bold', fontStyle: 'italic' },
        { src: `${base}/fonts/Lato-Light.ttf`,   fontWeight: 300,      fontStyle: 'normal' },
        { src: `${base}/fonts/Lato-Black.ttf`,   fontWeight: 900,      fontStyle: 'normal' },
      ],
    });

    const pdfStreamNode = await renderToStream(
      <CertificatePDF
        platform="English Proficiency Platform"
        logoUrl={logoUrl}
        user={{ name: displayName }}
        level={level}
        ladder={['A1', 'A2', 'B1', 'B2', 'C1', 'C2']}
        details={{
          certificateId,
          attemptId: attempt.id,
          issuedAt: issuedAt.toISOString(),
          region,
          descriptor: descriptorMap[level] || descriptorMap['A1'],
        }}
        verifyUrl={verifyUrl}
        qrDataUrl={qrDataUrl}
        arrowUrl={arrowUrl}
      />
    );

    const webStream = Readable.toWeb(pdfStreamNode);
    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${certificateId}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('PDF Generation Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error?.message ?? String(error) },
      { status: 500 }
    );
  }
}
