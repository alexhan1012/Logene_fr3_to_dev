# Logene_fr3_to_dev

> **FastReport (.fr3 / .frf) → DevExpress (.repx) 转换工具**  
> An Electron desktop application that converts FastReport template files into DevExpress REPX format, preserving component layout, styles, and database field bindings.

---

## Features

- 📂 Open `.fr3` (FastReport 3) and `.frf` (FastReport) files via a file dialog
- ⚙️  Convert report templates to DevExpress **REPX XML** format
- 🗂️  Preserves **component layout** (position, size) with accurate unit conversion (px → hundredths-of-an-inch)
- 🎨 Preserves **font** (name, size, style), **colors**, and **text alignment**
- 🔗 Preserves **database field bindings** (`DataSet` / `DataField` → `ExpressionBindings`)
- 💾 Save the generated `.repx` file to disk
- 🖥️ Side-by-side view of source XML and generated REPX

## Supported mappings

| FastReport band          | DevExpress band        |
|--------------------------|------------------------|
| `TfrxReportTitle`        | `ReportHeaderBand`     |
| `TfrxPageHeader`         | `PageHeaderBand`       |
| `TfrxMasterData`         | `DetailBand`           |
| `TfrxGroupHeader`        | `GroupHeaderBand`      |
| `TfrxGroupFooter`        | `GroupFooterBand`      |
| `TfrxPageFooter`         | `PageFooterBand`       |
| `TfrxReportSummary`      | `ReportFooterBand`     |

| FastReport component     | DevExpress control     |
|--------------------------|------------------------|
| `TfrxMemoView`           | `XRLabel`              |
| `TfrxLabel`              | `XRLabel`              |
| `TfrxRichText`           | `XRRichText`           |
| `TfrxPictureView`        | `XRPictureBox`         |
| `TfrxLine`               | `XRLine`               |
| `TfrxShape`              | `XRShape`              |
| `TfrxCheckBox`           | `XRCheckBox`           |
| `TfrxBarcode`            | `XRBarCode`            |

---

## Getting started

### Prerequisites
- [Node.js](https://nodejs.org/) 18+

### Install

```bash
npm install
```

### Run the app

```bash
npm start
```

### Run tests

```bash
npm test
```

---

## Sample files

Three sample report files are included in `samples/`:

| File | Description |
|------|-------------|
| `customer_sales.fr3` | Multi-band sales report with header, data, footer, summary |
| `employee_list.fr3` | Employee directory with page header/footer |
| `product_inventory.frf` | Product inventory with group header/footer and checkboxes |

---

## Project structure

```
├── main.js          # Electron main process (IPC handlers, dialogs)
├── preload.js       # Electron preload (contextBridge API)
├── index.html       # Renderer UI (two-pane layout)
├── renderer.js      # Renderer logic (open / convert / save)
├── src/
│   └── converter.js # Core FR3/FRF → REPX conversion logic
├── samples/         # Sample .fr3 / .frf files for testing
└── tests/
    └── converter.test.js  # Jest unit tests (37 tests)
```
