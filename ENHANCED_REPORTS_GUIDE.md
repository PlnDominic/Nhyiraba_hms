# Nhyiraba Hotel Enhanced Reporting Guide

## Overview

The Nhyiraba Hotel reporting module now combines polished branding with live operational data sourced from Supabase. This guide explains what was improved, how to use the enhanced reports, and how to tailor the solution for future needs.

## Branding and Identity

- **Hotel**: Nhyiraba Hotel
- **Location**: Oduom Anwomaso, Ghana
- **Telephone**: +233(0)248676262
- **Email**: info.lavimacroyalhotel@gmail.com
- **Tagline**: “Luxury & Excellence Redefined”
- **Logo Asset**: `/logo.jpg`
- **Primary Colours**: Navy (#1e40af), Emerald (#059669), Crimson (#dc2626), Gold (#d97706)

Each generated PDF displays the logo, hotel name, tagline, and contact details in both header and footer areas to ensure every report is presentation ready.

## Key Enhancements

1. **Live Data Integration** – Reports pull current information from the `rooms`, `reservations`, `guests`, `invoices`, and `tasks` tables. Financial outputs are normalised to Ghana Cedis (GH₵).
2. **Structured Layouts** – Executive sections, KPI summaries, and tables are organised to prevent overlap and improve legibility.
3. **Consistent File Packaging** – Exports follow the naming pattern `Nhyiraba_Hotel_{ReportType}_Report_{Timestamp}.pdf` for easy archiving.

## Available Report Types

- **Executive Summary** – High-level KPIs covering occupancy, revenue (GH₵), guest activity, and operational highlights.
- **Financial Performance** – Revenue sources, invoice status, and collection rates with Ghana Cedi totals.
- **Occupancy Analysis** – Room utilisation trends, availability, and booking distribution.
- **Guest Insights** – Guest registrations, stay patterns, and satisfaction indicators.
- **Housekeeping & Operations** – Task status, maintenance tracking, and service completion percentages.

## Using the Reports Module

1. Navigate to the **Reports** section of the Nhyiraba HMS dashboard.
2. Choose a report type and select an appropriate date range (for example: Last 30 Days or Custom Range).
3. Click **Generate Report**. The application retrieves current data, assembles the PDF, and saves the output in Supabase for future reference.
4. Download the generated file to share with management or operations teams.

## Data Inputs and Calculations

- **Revenue** – Aggregated from the `invoices` table and displayed in Ghana Cedis (GH₵).
- **Occupancy** – Derived from active reservations compared with total rooms.
- **Guest Metrics** – Counts and recent activity sourced from the `guests` table.
- **Operational Tasks** – Pulled from housekeeping and maintenance tasks to highlight completion rates.

## Configuration Reference

```javascript
const HOTEL_CONFIG = {
  name: 'Nhyiraba Hotel',
  tagline: 'Luxury & Excellence Redefined',
  address: 'Oduom Anwomaso, Ghana',
  phone: '+233(0)248676262',
  email: 'info.lavimacroyalhotel@gmail.com',
  website: 'www.lavimacroyal.com',
  logo: '/logo.jpg',
  currency: 'Ghana Cedis (GH₵)',
  colors: {
    primary: '#1e40af',
    secondary: '#059669',
    accent: '#dc2626',
    gold: '#d97706',
    dark: '#1f2937',
    light: '#f8fafc'
  }
};
```

Update this object if branding details or contact information change. All report templates consume these values.

## Customisation Guidance

- **Additional Report Types** – Extend the report switch statement, create a new content builder function, and define the Supabase queries required for the new metrics.
- **Alternative Branding** – Replace the logo file and adjust colour tokens within `HOTEL_CONFIG` to match refreshed guidelines.
- **Layout Tweaks** – Modify the shared styling utilities to adjust spacing, typography, or section ordering as designs evolve.

## Troubleshooting Checklist

1. **No Data Returned** – Confirm the selected date range contains activity and that the relevant Supabase tables hold data.
2. **Permission Errors** – Verify Row Level Security policies for the `reports` table permit insert and select operations for the current role.
3. **Branding Assets Missing** – Ensure `/logo.jpg` exists in the `public` directory deployed alongside the client application.
4. **Currency or Totals Incorrect** – Check that invoice amounts are stored as numeric strings and that they represent Ghana Cedis values.

## Future Considerations

- Integrate scheduled email delivery for recurring stakeholder updates.
- Add comparative views (month-on-month, year-on-year) within each report.
- Incorporate interactive dashboards alongside PDFs for daily monitoring.

## Support

For assistance or bespoke report requests, contact the Nhyiraba Hotel team at **info.lavimacroyalhotel@gmail.com** or call **+233(0)248676262**.


