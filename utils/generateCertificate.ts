/**
 * Generate a branded volunteer hours certificate as a PDF.
 * Uses expo-print to render HTML → PDF and expo-sharing for the share sheet.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { LOGO_BASE64, SIGNATURE_BASE64, SEAL_BASE64 } from './certificateAssets';

/* ------------------------------------------------------------------ */
/*  Certificate ID                                                     */
/* ------------------------------------------------------------------ */

function generateCertificateId(): string {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `VI-${year}-${code}`;
}

/* ------------------------------------------------------------------ */
/*  HTML template                                                      */
/* ------------------------------------------------------------------ */

function buildCertificateHtml(params: {
  fullName: string;
  totalHours: number;
  issueDate: string;
  certificateId: string;
}): string {
  const { fullName, totalHours, issueDate, certificateId } = params;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: letter portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 612pt; height: 792pt;
    font-family: Georgia, 'Times New Roman', serif;
    color: #1a1a1a;
    display: flex; align-items: center; justify-content: center;
    background: #fff;
  }

  .certificate {
    width: 556pt; height: 736pt;
    border: 3pt solid #4A90E2;
    border-radius: 4pt;
    position: relative;
    display: flex; flex-direction: column; align-items: center;
    padding: 36pt 40pt 28pt;
  }

  /* inner decorative border */
  .certificate::after {
    content: '';
    position: absolute;
    top: 6pt; left: 6pt; right: 6pt; bottom: 6pt;
    border: 1pt solid #D4AF37;
    border-radius: 2pt;
    pointer-events: none;
  }

  /* corner accents */
  .corner { position: absolute; width: 28pt; height: 28pt; }
  .corner::before, .corner::after {
    content: ''; position: absolute; background: #D4AF37;
  }
  .corner::before { width: 28pt; height: 2pt; }
  .corner::after  { width: 2pt; height: 28pt; }
  .tl { top: 12pt; left: 12pt; }
  .tr { top: 12pt; right: 12pt; }
  .tr::before { right: 0; }
  .tr::after  { right: 0; }
  .bl { bottom: 12pt; left: 12pt; }
  .bl::before { bottom: 0; }
  .bl::after  { bottom: 0; }
  .br { bottom: 12pt; right: 12pt; }
  .br::before { right: 0; bottom: 0; }
  .br::after  { right: 0; bottom: 0; }

  .logo { width: 80pt; height: 80pt; object-fit: contain; margin-bottom: 8pt; }

  .org-name {
    font-size: 11pt; letter-spacing: 3pt; text-transform: uppercase;
    color: #4A90E2; margin-bottom: 20pt; font-weight: 400;
  }

  .divider {
    width: 200pt; height: 1pt;
    background: linear-gradient(90deg, transparent, #D4AF37, transparent);
    margin-bottom: 20pt;
  }

  .title {
    font-size: 26pt; font-weight: 700; letter-spacing: 2pt;
    color: #2c3e50; margin-bottom: 6pt; text-transform: uppercase;
  }

  .subtitle {
    font-size: 12pt; letter-spacing: 2pt; text-transform: uppercase;
    color: #7f8c8d; margin-bottom: 28pt;
  }

  .preamble {
    font-size: 12pt; color: #555; margin-bottom: 10pt;
    font-style: italic;
  }

  .name {
    font-size: 28pt; font-weight: 700; color: #2c3e50;
    border-bottom: 2pt solid #D4AF37;
    padding-bottom: 4pt; margin-bottom: 24pt;
    text-align: center;
  }

  .body {
    font-size: 13pt; line-height: 1.7; text-align: center;
    color: #333; max-width: 400pt; margin-bottom: 12pt;
  }

  .hours {
    font-size: 15pt; font-weight: 700; color: #4A90E2;
  }

  .cert-id {
    font-size: 9pt; color: #999; letter-spacing: 1pt;
    margin-bottom: 10pt;
  }

  .spacer { flex: 1; }

  .footer {
    width: 100%;
    display: flex; flex-direction: row;
    justify-content: space-between; align-items: flex-end;
    padding: 0 20pt;
    position: relative;
    z-index: 1;
  }

  .sig-block { text-align: center; }
  .sig-img { width: 120pt; height: 48pt; object-fit: contain; }
  .sig-line { width: 140pt; border-top: 1pt solid #333; margin-top: 2pt; }
  .sig-label { font-size: 9pt; color: #555; margin-top: 4pt; }

  .seal-block { text-align: center; }
  .seal-img { width: 120pt; height: 120pt; object-fit: contain; opacity: 0.85; }

  .website {
    width: 100%; text-align: center;
    font-size: 9pt; color: #999; letter-spacing: 1pt;
    margin-top: 10pt; position: relative; z-index: 1;
  }
</style>
</head>
<body>
  <div class="certificate">
    <div class="corner tl"></div>
    <div class="corner tr"></div>
    <div class="corner bl"></div>
    <div class="corner br"></div>

    <img class="logo" src="${LOGO_BASE64}" />
    <div class="org-name">Volunteers Incorporated</div>
    <div class="divider"></div>
    <div class="title">Certificate</div>
    <div class="subtitle">of Volunteer Service</div>

    <div class="preamble">This certifies that</div>
    <div class="name">${fullName}</div>

    <div class="body">
      has completed <span class="hours">${totalHours}</span> volunteer hour${totalHours === 1 ? '' : 's'}
      with Volunteers Inc as of ${issueDate}.
    </div>

    <div class="cert-id">Certificate ID: ${certificateId}</div>

    <div class="spacer"></div>

    <div class="footer">
      <div class="sig-block">
        <img class="sig-img" src="${SIGNATURE_BASE64}" />
        <div class="sig-line"></div>
        <div class="sig-label">Volunteers Inc</div>
      </div>
      <div class="seal-block">
        <img class="seal-img" src="${SEAL_BASE64}" />
      </div>
    </div>

    <div class="website">volunteersinc.org</div>
  </div>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export async function generateAndShareCertificate(params: {
  fullName: string;
  totalHours: number;
}): Promise<void> {
  const { fullName, totalHours } = params;

  const issueDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const html = buildCertificateHtml({
    fullName,
    totalHours,
    issueDate,
    certificateId: generateCertificateId(),
  });

  if (Platform.OS === 'web') {
    // Open certificate in a new window and trigger print from there
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
    return;
  } else {
    const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 });
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share Hours Certificate',
      UTI: 'com.adobe.pdf',
    });
  }
}
