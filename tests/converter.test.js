'use strict';

const { convertFrToRepx, pxToHundredth, mapTextAlignment, frColorToHex, escapeXml } = require('../src/converter');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');

// ─── Unit helpers ─────────────────────────────────────────────────────────────
describe('pxToHundredth', () => {
  test('converts 96px to 100 (1 inch)', () => {
    expect(pxToHundredth('96')).toBeCloseTo(100, 1);
  });
  test('converts 0 to 0', () => {
    expect(pxToHundredth('0')).toBe(0);
  });
  test('converts 48 to ~50', () => {
    expect(pxToHundredth('48')).toBeCloseTo(50, 0);
  });
  test('handles numeric input', () => {
    expect(pxToHundredth(96)).toBeCloseTo(100, 1);
  });
  test('handles invalid input', () => {
    expect(pxToHundredth('abc')).toBe(0);
  });
});

// ─── Text alignment ───────────────────────────────────────────────────────────
describe('mapTextAlignment', () => {
  test('haLeft + vaTop → TopLeft', () => {
    expect(mapTextAlignment('haLeft', 'vaTop')).toBe('TopLeft');
  });
  test('haCenter + vaTop → TopCenter', () => {
    expect(mapTextAlignment('haCenter', 'vaTop')).toBe('TopCenter');
  });
  test('haRight + vaBottom → BottomRight', () => {
    expect(mapTextAlignment('haRight', 'vaBottom')).toBe('BottomRight');
  });
  test('haCenter + vaCenter → MiddleCenter', () => {
    expect(mapTextAlignment('haCenter', 'vaCenter')).toBe('MiddleCenter');
  });
  test('undefined defaults to TopLeft', () => {
    expect(mapTextAlignment(undefined, undefined)).toBe('TopLeft');
  });
});

// ─── Color conversion ─────────────────────────────────────────────────────────
describe('frColorToHex', () => {
  test('clNone returns Transparent', () => {
    expect(frColorToHex('clNone')).toBe('Transparent');
  });
  test('-1 returns Transparent', () => {
    expect(frColorToHex('-1')).toBe('Transparent');
  });
  test('0 returns Black', () => {
    expect(frColorToHex('0')).toBe('Black');
  });
  test('16777215 returns White', () => {
    expect(frColorToHex('16777215')).toBe('White');
  });
  test('clRed returns Red', () => {
    expect(frColorToHex('clRed')).toBe('Red');
  });
  test('undefined/null returns Transparent', () => {
    expect(frColorToHex(undefined)).toBe('Transparent');
    expect(frColorToHex(null)).toBe('Transparent');
  });
});

// ─── XML escape ───────────────────────────────────────────────────────────────
describe('escapeXml', () => {
  test('escapes &', () => expect(escapeXml('a&b')).toBe('a&amp;b'));
  test('escapes <', () => expect(escapeXml('a<b')).toBe('a&lt;b'));
  test('escapes >', () => expect(escapeXml('a>b')).toBe('a&gt;b'));
  test('escapes "', () => expect(escapeXml('a"b')).toBe('a&quot;b'));
  test('handles null', () => expect(escapeXml(null)).toBe(''));
});

// ─── Full conversion tests ────────────────────────────────────────────────────
describe('convertFrToRepx', () => {
  test('throws on invalid XML', async () => {
    await expect(convertFrToRepx('not xml')).rejects.toThrow();
  });

  test('throws when TfrxReport root is missing', async () => {
    const xml = '<?xml version="1.0"?><SomeOtherRoot/>';
    await expect(convertFrToRepx(xml)).rejects.toThrow(/TfrxReport/);
  });

  test('throws when no pages found', async () => {
    // Use an attribute so xml2js parses TfrxReport as an object (not empty string)
    const xml = '<?xml version="1.0"?><TfrxReport Name="test"/>';
    await expect(convertFrToRepx(xml)).rejects.toThrow(/No report pages/);
  });

  test('generates valid XML with REPX root element', async () => {
    const fr3 = `<?xml version="1.0"?>
<TfrxReport>
  <TfrxPageDesigner Name="Page1" PaperWidth="827" PaperHeight="1169"
                    LeftMargin="31" RightMargin="31" TopMargin="31" BottomMargin="31">
    <TfrxMasterData Name="Detail1" Height="20">
      <TfrxMemoView Name="lbl1" Left="0" Top="0" Width="200" Height="20"
        Text="Hello World" HAlign="haLeft" VAlign="vaTop"/>
    </TfrxMasterData>
  </TfrxPageDesigner>
</TfrxReport>`;

    const repx = await convertFrToRepx(fr3);
    expect(repx).toContain('<XtraReportsLayoutSerializer>');
    expect(repx).toContain('<XtraReport');
    expect(repx).toContain('</XtraReport>');
    expect(repx).toContain('</XtraReportsLayoutSerializer>');
  });

  test('converts TfrxMemoView to XRLabel', async () => {
    const fr3 = `<?xml version="1.0"?>
<TfrxReport>
  <TfrxPageDesigner Name="Page1" PaperWidth="793" PaperHeight="1123"
                    LeftMargin="30" RightMargin="30" TopMargin="30" BottomMargin="30">
    <TfrxMasterData Name="Detail1" Height="20">
      <TfrxMemoView Name="myLabel" Left="10" Top="5" Width="100" Height="20"
        Text="Sample Text" HAlign="haLeft" VAlign="vaTop"/>
    </TfrxMasterData>
  </TfrxPageDesigner>
</TfrxReport>`;

    const repx = await convertFrToRepx(fr3);
    expect(repx).toContain('ControlType="XRLabel"');
    expect(repx).toContain('Name="myLabel"');
    expect(repx).toContain('Text="Sample Text"');
  });

  test('preserves data bindings in ExpressionBindings', async () => {
    const fr3 = `<?xml version="1.0"?>
<TfrxReport>
  <TfrxPageDesigner Name="Page1" PaperWidth="793" PaperHeight="1123"
                    LeftMargin="30" RightMargin="30" TopMargin="30" BottomMargin="30">
    <TfrxMasterData Name="Detail1" Height="20">
      <TfrxMemoView Name="fldName" Left="0" Top="0" Width="150" Height="20"
        DataSet="qryCustomers" DataField="CustomerName"
        HAlign="haLeft" VAlign="vaTop"/>
    </TfrxMasterData>
  </TfrxPageDesigner>
</TfrxReport>`;

    const repx = await convertFrToRepx(fr3);
    expect(repx).toContain('ExpressionBindings');
    expect(repx).toContain('[qryCustomers].[CustomerName]');
  });

  test('maps band types correctly', async () => {
    const fr3 = `<?xml version="1.0"?>
<TfrxReport>
  <TfrxPageDesigner Name="Page1" PaperWidth="793" PaperHeight="1123"
                    LeftMargin="30" RightMargin="30" TopMargin="30" BottomMargin="30">
    <TfrxReportTitle Name="Title1" Height="40"/>
    <TfrxPageHeader Name="Header1" Height="25"/>
    <TfrxMasterData Name="Detail1" Height="20"/>
    <TfrxPageFooter Name="Footer1" Height="20"/>
    <TfrxReportSummary Name="Summary1" Height="30"/>
  </TfrxPageDesigner>
</TfrxReport>`;

    const repx = await convertFrToRepx(fr3);
    expect(repx).toContain('ControlType="ReportHeaderBand"');
    expect(repx).toContain('ControlType="PageHeaderBand"');
    expect(repx).toContain('ControlType="DetailBand"');
    expect(repx).toContain('ControlType="PageFooterBand"');
    expect(repx).toContain('ControlType="ReportFooterBand"');
  });

  test('converts coordinates with unit conversion', async () => {
    const fr3 = `<?xml version="1.0"?>
<TfrxReport>
  <TfrxPageDesigner Name="Page1" PaperWidth="793" PaperHeight="1123"
                    LeftMargin="30" RightMargin="30" TopMargin="30" BottomMargin="30">
    <TfrxMasterData Name="Detail1" Height="96">
      <TfrxMemoView Name="lbl" Left="96" Top="96" Width="192" Height="96"
        Text="Test" HAlign="haLeft" VAlign="vaTop"/>
    </TfrxMasterData>
  </TfrxPageDesigner>
</TfrxReport>`;

    const repx = await convertFrToRepx(fr3);
    // 96px → 100 hundredths-of-an-inch
    expect(repx).toContain('LocationFloat="100,');
    expect(repx).toContain('SizeF="200,');
  });

  test('converts TfrxLine to XRLine', async () => {
    const fr3 = `<?xml version="1.0"?>
<TfrxReport>
  <TfrxPageDesigner Name="Page1" PaperWidth="793" PaperHeight="1123"
                    LeftMargin="30" RightMargin="30" TopMargin="30" BottomMargin="30">
    <TfrxPageHeader Name="Header1" Height="25">
      <TfrxLine Name="line1" Left="0" Top="22" Width="733" Height="2"/>
    </TfrxPageHeader>
  </TfrxPageDesigner>
</TfrxReport>`;

    const repx = await convertFrToRepx(fr3);
    expect(repx).toContain('ControlType="XRLine"');
    expect(repx).toContain('Name="line1"');
  });

  test('converts TfrxCheckBox to XRCheckBox with data binding', async () => {
    const fr3 = `<?xml version="1.0"?>
<TfrxReport>
  <TfrxPageDesigner Name="Page1" PaperWidth="793" PaperHeight="1123"
                    LeftMargin="30" RightMargin="30" TopMargin="30" BottomMargin="30">
    <TfrxMasterData Name="Detail1" Height="20">
      <TfrxCheckBox Name="chk1" Left="0" Top="2" Width="80" Height="16"
        DataSet="dsProducts" DataField="IsActive"/>
    </TfrxMasterData>
  </TfrxPageDesigner>
</TfrxReport>`;

    const repx = await convertFrToRepx(fr3);
    expect(repx).toContain('ControlType="XRCheckBox"');
    expect(repx).toContain('[dsProducts].[IsActive]');
  });

  test('includes TopMarginBand and BottomMarginBand', async () => {
    const fr3 = `<?xml version="1.0"?>
<TfrxReport>
  <TfrxPageDesigner Name="Page1" PaperWidth="793" PaperHeight="1123"
                    LeftMargin="30" RightMargin="30" TopMargin="30" BottomMargin="30">
    <TfrxMasterData Name="Detail1" Height="20"/>
  </TfrxPageDesigner>
</TfrxReport>`;

    const repx = await convertFrToRepx(fr3);
    expect(repx).toContain('ControlType="TopMarginBand"');
    expect(repx).toContain('ControlType="BottomMarginBand"');
  });

  test('output is parseable XML', async () => {
    const fr3 = `<?xml version="1.0"?>
<TfrxReport>
  <TfrxPageDesigner Name="Page1" PaperWidth="793" PaperHeight="1123"
                    LeftMargin="30" RightMargin="30" TopMargin="30" BottomMargin="30">
    <TfrxMasterData Name="Detail1" Height="20">
      <TfrxMemoView Name="lbl" Left="0" Top="0" Width="200" Height="20"
        Text="Test &amp; Check" HAlign="haLeft" VAlign="vaTop"
        DataSet="ds" DataField="field1"/>
    </TfrxMasterData>
  </TfrxPageDesigner>
</TfrxReport>`;

    const repx = await convertFrToRepx(fr3);
    // Should be parseable without error
    const parsed = await xml2js.parseStringPromise(repx);
    expect(parsed).toBeTruthy();
    expect(parsed.XtraReportsLayoutSerializer).toBeTruthy();
  });

  // ─── Test with sample files ─────────────────────────────────────────────────
  const samplesDir = path.join(__dirname, '..', 'samples');

  test('converts customer_sales.fr3 sample without error', async () => {
    const xml = fs.readFileSync(path.join(samplesDir, 'customer_sales.fr3'), 'utf-8');
    const repx = await convertFrToRepx(xml);
    expect(repx).toContain('<XtraReportsLayoutSerializer>');
    // Check data bindings preserved
    expect(repx).toContain('[qrySales].[CustomerName]');
    expect(repx).toContain('[qrySales].[SaleAmount]');
    expect(repx).toContain('[qrySales].[SaleDate]');
  });

  test('converts employee_list.fr3 sample without error', async () => {
    const xml = fs.readFileSync(path.join(samplesDir, 'employee_list.fr3'), 'utf-8');
    const repx = await convertFrToRepx(xml);
    expect(repx).toContain('<XtraReportsLayoutSerializer>');
    expect(repx).toContain('[dsEmployee].[FirstName]');
    expect(repx).toContain('[dsEmployee].[LastName]');
    expect(repx).toContain('[dsEmployee].[Department]');
  });

  test('converts product_inventory.frf sample without error', async () => {
    const xml = fs.readFileSync(path.join(samplesDir, 'product_inventory.frf'), 'utf-8');
    const repx = await convertFrToRepx(xml);
    expect(repx).toContain('<XtraReportsLayoutSerializer>');
    expect(repx).toContain('[dsProducts].[ProductName]');
    expect(repx).toContain('[dsProducts].[IsActive]');
    expect(repx).toContain('ControlType="XRCheckBox"');
    expect(repx).toContain('ControlType="GroupHeaderBand"');
  });

  test('sample output is valid XML', async () => {
    const xml = fs.readFileSync(path.join(samplesDir, 'customer_sales.fr3'), 'utf-8');
    const repx = await convertFrToRepx(xml);
    const parsed = await xml2js.parseStringPromise(repx);
    expect(parsed.XtraReportsLayoutSerializer).toBeTruthy();
  });
});
