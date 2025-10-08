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
} from '@react-pdf/renderer';
import { Readable } from 'stream';

// ───────────────── helpers ─────────────────

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
    <rect width="100%" height="100%" fill="#0ea5e9"/>
    <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
      font-family="system-ui, -apple-system, Segoe UI" font-size="28" fill="white">
      English Proficiency
    </text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function resolveLogoUrlAbsolute(baseUrl) {
  const fromEnv = process.env.CERT_LOGO_URL;
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) return fromEnv;
  if (baseUrl) return `${baseUrl.replace(/\/$/, '')}/cert/logo.png`;
  return placeholderLogoDataUrl();
}

function levelLabel(code) {
  switch (code) {
    case 'A1':
      return 'Beginner';
    case 'A2':
      return 'Elementary';
    case 'B1':
      return 'Intermediate';
    case 'B2':
      return 'Upper Intermediate';
    case 'C1':
      return 'Advanced';
    case 'C2':
      return 'Proficiency';
    default:
      return '';
  }
}

function formatDate(isoOrDate) {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ───────────────── PDF Styles ─────────────────

const styles = StyleSheet.create({
  page: {
    padding: 0,
    backgroundColor: '#FFFFFF',
    fontSize: 10,
    color: '#2A2F45',
  },
  header: {
    backgroundColor: '#1A2D5A',
    color: '#FFFFFF',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platform: {
    fontSize: 12,
    fontWeight: 600,
    marginTop: 6,
  },
  content: {
    paddingHorizontal: 40, // ~14mm
  },
  logoBox: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 4,
  },
  logo: {
    width: 140,
    height: 40,
    objectFit: 'contain',
  },
  titleWrap: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  h1: {
    fontSize: 28,
    fontWeight: 700,
    color: '#243E76',
    marginTop: 20,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#000000',
  },
  rule: {
    height: 2,
    backgroundColor: '#EDC55D',
    marginVertical: 12,
  },
  lead: {
    textAlign: 'center',
    color: '#8B92A0',
    fontSize: 10.5,
    marginTop: 18,
    marginBottom: 6,
  },
  name: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 700,
    color: '#2F487D',
    textDecoration: 'underline',
    textDecorationColor: '#EDC55D',
    textDecorationStyle: 'solid',
    textDecorationThickness: 2,
    marginBottom: 8,
  },
  desc: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 10.5,
    lineHeight: 1.5,
    marginHorizontal: 18,
    marginBottom: 10,
  },
  highlight: {
    color: '#FBCD63',
    fontWeight: 800,
  },
  panel: {
    backgroundColor: '#F1F3F5',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  levelTitle: {
    textAlign: 'center',
    color: '#5D6F97',
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
  },
  ladder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 6,
  },
  step: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 4,
    width: 90,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  stepActive: {
    backgroundColor: '#FAC338',
    borderColor: '#FAC338',
  },
  stepCode: {
    fontWeight: 800,
    fontSize: 12,
    color: '#2A2F45',
  },
  stepCodeActive: {
    color: '#1A2D5A',
  },
  stepLabel: {
    fontSize: 9,
    color: '#6B7280',
  },
  stepLabelActive: {
    color: '#2A2F45',
    fontWeight: 700,
  },
  arrow: {
    fontSize: 12,
    color: '#9AA3B2',
    marginHorizontal: 2,
  },
  bullet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 11,
    color: '#2A2F45',
    lineHeight: 1.4,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FAC137',
    color: '#75663C',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    fontSize: 9.5,
    fontWeight: 700,
    marginBottom: 6,
  },
  detailsPanel: {
    backgroundColor: '#FAFBFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  detailsTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#4D638F',
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  box: {
    width: '48%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  metaLabel: {
    fontSize: 9,
    color: '#989EAF',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 10,
    color: '#555862',
  },
  dividerCard: {
    backgroundColor: '#FAFBFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    height: 12,
    marginTop: 12,
  },
  verifyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 18,
    alignItems: 'flex-start',
  },
  verifyLeft: {
    flex: 1,
  },
  verifyTitle: {
    fontSize: 11,
    color: '#556A94',
    marginBottom: 8,
  },
  verifyText: {
    fontSize: 10,
    color: '#6B7280',
    lineHeight: 1.6,
  },
  verifyUrl: {
    fontSize: 10,
    fontFamily: 'Courier',
    color: '#FACD6A',
    marginTop: 4,
  },
  qrWrap: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 6,
  },
  qr: {
    width: 90,
    height: 90,
    objectFit: 'contain',
  },
  bottomRule: {
    height: 5,
    backgroundColor: '#847446',
    marginVertical: 24,
  },
});

// ───────────────── PDF Component ─────────────────

function CertificatePDF({
  platform,
  logoUrl,
  user,
  level,
  ladder,
  details,
  verifyUrl,
  qrDataUrl,
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {logoUrl ? (
            <View style={styles.logoBox}>
              <Image style={styles.logo} src={logoUrl} />
            </View>
          ) : null}
          <Text style={styles.platform}>{platform}</Text>
        </View>

        <View style={styles.content}>
          {/* Title */}
          <View style={styles.titleWrap}>
            <Text style={styles.h1}>CERTIFICATE</Text>
            <Text style={styles.subtitle}>of English Proficiency</Text>
          </View>
          <View style={styles.rule} />

          {/* Name + description */}
          <Text style={styles.lead}>This is to certify that</Text>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.desc}>
            has successfully completed the English Proficiency Test on platform.com and has
            demonstrated the <Text style={styles.highlight}>{level}</Text> level of English in
            accordance with the Common European Framework of Reference for Languages (CEFR).
          </Text>

          {/* Level panel */}
          <View style={styles.panel}>
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
                    {i < ladder.length - 1 ? <Text style={styles.arrow}>→</Text> : null}
                  </React.Fragment>
                );
              })}
            </View>

            <View style={styles.bullet}>
              <Text style={styles.pill}>
                {level} — {levelLabel(level)}
              </Text>
              <Text>"{details.descriptor}"</Text>
            </View>
          </View>

          {/* Details panel */}
          <View style={styles.detailsPanel}>
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

          <View style={styles.dividerCard} />

          {/* Verification row */}
          <View style={styles.verifyRow}>
            <View style={styles.verifyLeft}>
              <Text style={styles.verifyTitle}>Verification</Text>
              <Text style={styles.verifyText}>
                To verify the authenticity of this certificate, scan the QR code or visit:
              </Text>
              <Text style={styles.verifyUrl}>{verifyUrl}</Text>
              <Text
                style={{
                  color: '#A2A6B3',
                  fontSize: 9,
                  marginTop: 6,
                  fontStyle: 'italic',
                  maxWidth: 350,
                }}
              >
                This certificate is digitally issued and verified by English Proficiency Platform
                Assessment System; no manual signature required.
              </Text>
            </View>
            <View style={styles.qrWrap}>
              <Image style={styles.qr} src={qrDataUrl} />
            </View>
          </View>

          <View style={styles.bottomRule} />
        </View>
      </Page>
    </Document>
  );
}

// ───────────────── route ─────────────────

export async function GET(_req, context) {
  try {
    const { id } = context.params;

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
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, scale: 6 });

    const logoUrl = resolveLogoUrlAbsolute(base);

    const displayName = (attempt.user.fullName || '')
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    const level = attempt.level || 'A1';

    const descriptorMap = {
      A1: 'Can understand and use familiar everyday expressions and very basic phrases aimed at the satisfaction of needs of a concrete type.',
      A2: 'Can communicate in simple and routine tasks requiring a simple and direct exchange of information on familiar topics and activities.',
      B1: 'Can understand the main points of clear standard input on familiar matters regularly encountered in work, school, leisure, etc.',
      B2: 'Can understand the main ideas of complex text on both concrete and abstract topics, including technical discussions in their field of specialization.',
      C1: 'Can express ideas fluently and spontaneously without much obvious searching for expressions.',
      C2: 'Can understand with ease virtually everything heard or read and can express themselves spontaneously, very fluently and precisely.',
    };

    // Build PDF as a stream (low memory)
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
      />
    );

    // Node stream → Web ReadableStream
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
