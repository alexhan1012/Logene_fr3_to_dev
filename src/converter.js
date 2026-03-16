'use strict';

const xml2js = require('xml2js');

// ─── Unit conversion ──────────────────────────────────────────────────────────
// FastReport fr3/frf stores coordinates in "pixels" at 96 dpi.
// DevExpress REPX uses HundredthsOfAnInch (100 units = 1 inch).
// 1 px at 96 dpi = 1/96 inch = 100/96 hundredths-of-an-inch ≈ 1.04167

const PX_TO_HUNDRETH = 100 / 96;

function pxToHundredth(px) {
  const n = parseFloat(px);
  return isNaN(n) ? 0 : Math.round(n * PX_TO_HUNDRETH * 100) / 100;
}

// ─── Font style helpers ───────────────────────────────────────────────────────
function parseFontStyle(styleStr) {
  if (!styleStr) return { bold: false, italic: false, underline: false };
  return {
    bold: styleStr.includes('fsBold') || styleStr.includes('Bold'),
    italic: styleStr.includes('fsItalic') || styleStr.includes('Italic'),
    underline: styleStr.includes('fsUnderline') || styleStr.includes('Underline'),
  };
}

function buildFontStyle(fontStyle) {
  const parts = [];
  if (fontStyle.bold) parts.push('Bold');
  if (fontStyle.italic) parts.push('Italic');
  if (fontStyle.underline) parts.push('Underline');
  return parts.length > 0 ? parts.join(', ') : 'Regular';
}

// ─── Text-alignment map ───────────────────────────────────────────────────────
const HALIGN_MAP = {
  haLeft: 'Left',
  haRight: 'Right',
  haCenter: 'Center',
  haJustify: 'Justify',
  '0': 'Left',
  '1': 'Right',
  '2': 'Center',
  '3': 'Justify',
};

const VALIGN_MAP = {
  vaTop: 'Top',
  vaBottom: 'Bottom',
  vaCenter: 'Middle',
  '0': 'Top',
  '1': 'Bottom',
  '2': 'Middle',
};

function mapTextAlignment(hAlign, vAlign) {
  const h = HALIGN_MAP[hAlign] || 'Left';
  const v = VALIGN_MAP[vAlign] || 'Top';
  return `${v}${h}`;
}

// ─── Band type map ────────────────────────────────────────────────────────────
const BAND_TYPE_MAP = {
  TfrxReportTitle: 'ReportHeaderBand',
  TfrxPageHeader: 'PageHeaderBand',
  TfrxMasterData: 'DetailBand',
  TfrxDetailData: 'DetailBand',
  TfrxGroupHeader: 'GroupHeaderBand',
  TfrxGroupFooter: 'GroupFooterBand',
  TfrxPageFooter: 'PageFooterBand',
  TfrxReportSummary: 'ReportFooterBand',
  TfrxSubDetail: 'DetailBand',
  TfrxColumnHeader: 'ColumnHeaderBand',
  TfrxColumnFooter: 'ColumnFooterBand',
};

// ─── Component type map ───────────────────────────────────────────────────────
const COMP_TYPE_MAP = {
  TfrxMemoView: 'XRLabel',
  TfrxLabel: 'XRLabel',
  TfrxRichText: 'XRRichText',
  TfrxPictureView: 'XRPictureBox',
  TfrxLine: 'XRLine',
  TfrxShape: 'XRShape',
  TfrxCheckBox: 'XRCheckBox',
  TfrxBarcode: 'XRBarCode',
  TfrxSubreport: 'XRSubreport',
};

// ─── Color conversion ─────────────────────────────────────────────────────────
// FastReport stores colors as decimal integers (BGR order) or TColor constants.
function frColorToHex(colorVal) {
  if (!colorVal || colorVal === 'clNone' || colorVal === '-1') return 'Transparent';
  if (colorVal === 'clWhite' || colorVal === '16777215') return 'White';
  if (colorVal === 'clBlack' || colorVal === '0') return 'Black';
  if (colorVal === 'clRed') return 'Red';
  if (colorVal === 'clBlue') return 'Blue';
  if (colorVal === 'clGreen') return 'Green';
  if (colorVal === 'clYellow') return 'Yellow';
  const n = parseInt(colorVal, 10);
  if (isNaN(n)) return colorVal;
  // FR3 stores as BGR (Delphi TColor)
  const b = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const r = n & 0xff;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ─── XML escape ───────────────────────────────────────────────────────────────
function escapeXml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Parse FastReport attributes from xml2js object ──────────────────────────
function getAttrs(obj) {
  return (obj && obj.$) ? obj.$ : {};
}

// ─── Reference counter ────────────────────────────────────────────────────────
let refCounter = 0;

function nextRef() {
  refCounter += 1;
  return refCounter;
}

// ─── Convert a single FR component to REPX XML string ────────────────────────
function convertComponent(frType, attrs, index) {
  const devType = COMP_TYPE_MAP[frType];
  if (!devType) return null;

  const ref = nextRef();
  const name = attrs.Name || `${devType.toLowerCase()}${ref}`;
  const left = pxToHundredth(attrs.Left || '0');
  const top = pxToHundredth(attrs.Top || '0');
  const width = pxToHundredth(attrs.Width || '100');
  const height = pxToHundredth(attrs.Height || '20');

  const textAlign = mapTextAlignment(attrs.HAlign, attrs.VAlign);

  // Font
  const fontName = attrs['Font.Name'] || attrs.FontName || 'Arial';
  const fontSize = attrs['Font.Size'] || attrs.FontSize || '10';
  const fontStyleRaw = attrs['Font.Style'] || attrs.FontStyle || '';
  const fontStyle = parseFontStyle(fontStyleRaw);
  const fontStyleStr = buildFontStyle(fontStyle);

  // Colors
  const foreColor = frColorToHex(attrs.Color || attrs.FontColor);
  const backColor = frColorToHex(attrs.FillColor || attrs.BrushColor);

  // Text content
  const text = attrs.Text || '';

  // Data binding
  const dataSet = attrs.DataSet || attrs.Dataset || '';
  const dataField = attrs.DataField || attrs.Datafield || '';
  let expression = '';
  if (dataField) {
    expression = dataSet ? `[${dataSet}].[${dataField}]` : `[${dataField}]`;
  }

  const itemTag = `Item${index + 1}`;
  const lines = [];

  if (devType === 'XRLabel' || devType === 'XRRichText') {
    lines.push(`          <${itemTag} Ref="${ref}" ControlType="${devType}" Name="${escapeXml(name)}"`);
    lines.push(`                   TextAlignment="${textAlign}"`);
    lines.push(`                   LocationFloat="${left}, ${top}" SizeF="${width}, ${height}"`);
    if (text) lines.push(`                   Text="${escapeXml(text)}"`);
    if (fontName !== 'Arial' || fontSize !== '10' || fontStyleStr !== 'Regular') {
      const stylePart = fontStyleStr !== 'Regular' ? `, ${fontStyleStr}` : '';
      lines.push(`                   Font="${escapeXml(fontName)}, ${fontSize}pt${stylePart}"`);
    }
    if (foreColor && foreColor !== 'Transparent' && foreColor !== 'Black') {
      lines.push(`                   ForeColor="${foreColor}"`);
    }
    if (backColor && backColor !== 'Transparent') {
      lines.push(`                   BackColor="${backColor}"`);
    }
    if (expression) {
      lines[lines.length - 1] += '>';
      lines.push(`            <ExpressionBindings>`);
      lines.push(`              <Item1 Ref="${nextRef()}" ControlType="ExpressionBinding"`);
      lines.push(`                     EventName="BeforePrint" PropertyName="Text"`);
      lines.push(`                     Expression="${escapeXml(expression)}"/>`);
      lines.push(`            </ExpressionBindings>`);
      lines.push(`          </${itemTag}>`);
    } else {
      lines[lines.length - 1] += '/>';
    }
  } else if (devType === 'XRLine') {
    lines.push(`          <${itemTag} Ref="${ref}" ControlType="XRLine" Name="${escapeXml(name)}"`);
    lines.push(`                   LocationFloat="${left}, ${top}" SizeF="${width}, ${height}"/>`);
  } else if (devType === 'XRPictureBox') {
    lines.push(`          <${itemTag} Ref="${ref}" ControlType="XRPictureBox" Name="${escapeXml(name)}"`);
    lines.push(`                   LocationFloat="${left}, ${top}" SizeF="${width}, ${height}"/>`);
  } else if (devType === 'XRCheckBox') {
    lines.push(`          <${itemTag} Ref="${ref}" ControlType="XRCheckBox" Name="${escapeXml(name)}"`);
    lines.push(`                   LocationFloat="${left}, ${top}" SizeF="${width}, ${height}"`);
    if (expression) {
      lines[lines.length - 1] += '>';
      lines.push(`            <ExpressionBindings>`);
      lines.push(`              <Item1 Ref="${nextRef()}" ControlType="ExpressionBinding"`);
      lines.push(`                     EventName="BeforePrint" PropertyName="CheckState"`);
      lines.push(`                     Expression="${escapeXml(expression)}"/>`);
      lines.push(`            </ExpressionBindings>`);
      lines.push(`          </${itemTag}>`);
    } else {
      lines[lines.length - 1] += '/>';
    }
  } else if (devType === 'XRBarCode') {
    lines.push(`          <${itemTag} Ref="${ref}" ControlType="XRBarCode" Name="${escapeXml(name)}"`);
    lines.push(`                   LocationFloat="${left}, ${top}" SizeF="${width}, ${height}"`);
    if (expression) {
      lines[lines.length - 1] += '>';
      lines.push(`            <ExpressionBindings>`);
      lines.push(`              <Item1 Ref="${nextRef()}" ControlType="ExpressionBinding"`);
      lines.push(`                     EventName="BeforePrint" PropertyName="Text"`);
      lines.push(`                     Expression="${escapeXml(expression)}"/>`);
      lines.push(`            </ExpressionBindings>`);
      lines.push(`          </${itemTag}>`);
    } else {
      lines[lines.length - 1] += '/>';
    }
  } else {
    lines.push(`          <${itemTag} Ref="${ref}" ControlType="${devType}" Name="${escapeXml(name)}"`);
    lines.push(`                   LocationFloat="${left}, ${top}" SizeF="${width}, ${height}"/>`);
  }

  return lines.join('\n');
}

// ─── Extract all child components from a band xml2js object ──────────────────
const FR_COMPONENT_TYPES = Object.keys(COMP_TYPE_MAP);

function extractComponents(bandObj) {
  const results = [];
  for (const frType of FR_COMPONENT_TYPES) {
    const items = bandObj[frType];
    if (!items) continue;
    const arr = Array.isArray(items) ? items : [items];
    for (const item of arr) {
      const attrs = getAttrs(item);
      results.push({ frType, attrs });
    }
  }
  return results;
}

// ─── Convert a single band ────────────────────────────────────────────────────
function convertBand(frType, bandObj, bandIndex) {
  const devBandType = BAND_TYPE_MAP[frType];
  if (!devBandType) return null;

  const ref = nextRef();
  const attrs = getAttrs(bandObj);
  const name = attrs.Name || `${devBandType}${bandIndex + 1}`;
  const height = pxToHundredth(attrs.Height || '50');

  const components = extractComponents(bandObj);
  const compLines = [];
  for (let i = 0; i < components.length; i++) {
    const { frType: cType, attrs: cAttrs } = components[i];
    const xml = convertComponent(cType, cAttrs, i);
    if (xml) compLines.push(xml);
  }

  const lines = [];
  lines.push(`      <Band Ref="${ref}" ControlType="${devBandType}" Name="${escapeXml(name)}" HeightF="${height}">`);
  if (compLines.length > 0) {
    lines.push(`        <Controls>`);
    lines.push(compLines.join('\n'));
    lines.push(`        </Controls>`);
  }
  lines.push(`      </Band>`);
  return lines.join('\n');
}

// ─── Extract all bands from a page xml2js object ─────────────────────────────
const FR_BAND_TYPES = Object.keys(BAND_TYPE_MAP);

function extractBands(pageObj) {
  const results = [];
  for (const frType of FR_BAND_TYPES) {
    const items = pageObj[frType];
    if (!items) continue;
    const arr = Array.isArray(items) ? items : [items];
    for (const item of arr) {
      results.push({ frType, bandObj: item });
    }
  }
  return results;
}

// ─── Build the complete REPX XML document ────────────────────────────────────
function buildRepx(pageAttrs, bandXmlList) {
  const pageWidth = pxToHundredth(pageAttrs.PaperWidth || pageAttrs.Width || '793');
  const pageHeight = pxToHundredth(pageAttrs.PaperHeight || pageAttrs.Height || '1123');
  const marginLeft = pxToHundredth(pageAttrs.LeftMargin || '30');
  const marginRight = pxToHundredth(pageAttrs.RightMargin || '30');
  const marginTop = pxToHundredth(pageAttrs.TopMargin || '30');
  const marginBottom = pxToHundredth(pageAttrs.BottomMargin || '30');

  const lines = [];
  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push('<XtraReportsLayoutSerializer>');
  lines.push(`  <XtraReport ReportUnit="HundredthsOfAnInch"`);
  lines.push(`              PageWidth="${pageWidth}" PageHeight="${pageHeight}"`);
  lines.push(`              Margins="${marginLeft}, ${marginRight}, ${marginTop}, ${marginBottom}"`);
  lines.push(`              SnapGridSize="12.5" Name="XtraReport1">`);
  lines.push(`    <Bands>`);
  const topRef = nextRef();
  const botRef = nextRef();
  lines.push(`      <Band Ref="${topRef}" ControlType="TopMarginBand" Name="TopMargin" HeightF="${marginTop}"/>`);
  lines.push(`      <Band Ref="${botRef}" ControlType="BottomMarginBand" Name="BottomMargin" HeightF="${marginBottom}"/>`);
  for (const bandXml of bandXmlList) {
    if (bandXml) lines.push(bandXml);
  }
  lines.push(`    </Bands>`);
  lines.push(`  </XtraReport>`);
  lines.push(`</XtraReportsLayoutSerializer>`);
  return lines.join('\n');
}

// ─── Main public API ──────────────────────────────────────────────────────────
/**
 * Convert a FastReport fr3/frf XML string to a DevExpress REPX XML string.
 * @param {string} frXml  Contents of the .fr3 or .frf file.
 * @returns {Promise<string>} REPX XML string.
 */
async function convertFrToRepx(frXml) {
  refCounter = 0; // reset for each conversion

  const parsed = await xml2js.parseStringPromise(frXml, {
    explicitArray: true,
    mergeAttrs: false,
    explicitCharkey: false,
  });

  // FR3 root element is always TfrxReport
  const root = parsed.TfrxReport;
  if (!root) throw new Error('Invalid FastReport XML: missing <TfrxReport> root element.');

  // Pages live under TfrxPageDesigner or TfrxReportPage
  const pages = root.TfrxPageDesigner || root.TfrxReportPage || [];
  const pageArr = Array.isArray(pages) ? pages : [pages];

  if (pageArr.length === 0 || !pageArr[0]) {
    throw new Error('No report pages found in FastReport file.');
  }

  const firstPage = pageArr[0];
  const pageAttrs = getAttrs(firstPage);

  const bands = extractBands(firstPage);
  const bandXmlList = [];
  for (let i = 0; i < bands.length; i++) {
    const { frType, bandObj } = bands[i];
    const xml = convertBand(frType, bandObj, i);
    if (xml) bandXmlList.push(xml);
  }

  return buildRepx(pageAttrs, bandXmlList);
}

module.exports = {
  convertFrToRepx,
  pxToHundredth,
  mapTextAlignment,
  frColorToHex,
  escapeXml,
};
