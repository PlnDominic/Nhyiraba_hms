# Nhyiraba Hotel Professional Reporting Implementation Guide

## Purpose

This guide documents the steps taken to modernise the Nhyiraba Hotel reporting workflow and explains how to maintain the enhanced solution. The updated implementation removes hard-coded metrics, ensures every financial value is expressed in Ghana Cedis (GH₵), and applies consistent hotel branding across all generated outputs.

## Summary of Fixes

- **Live data sourcing** – `EnhancedReportsWithRealData` retrieves information from Supabase tables (`rooms`, `reservations`, `guests`, `invoices`, `tasks`, and `service_requests`) and calculates KPIs dynamically.
- **Professional PDF generation** – Shared header and footer utilities apply the Nhyiraba brand, contact details, and generation timestamp to every report page.
- **Layout stabilisation** – Section spacing, typography, and KPI blocks were reorganised to eliminate textual overlap.

## Implementation Notes

1. Import the enhanced component within the Reports module and render it in place of the legacy implementation.
2. Ensure Supabase credentials allow the component to query the required tables for the selected date range.
3. Confirm the `HOTEL_CONFIG` object reflects the current hotel identity (see configuration snapshot below).

```javascript
const HOTEL_CONFIG = {
  name: 'Nhyiraba Hotel',
  tagline: 'Luxury & Excellence Redefined',
  address: 'Oduom Anwomaso, Ghana',
  phone: '+233(0)248676262',
  email: 'info.lavimacroyalhotel@gmail.com',
  website: 'www.lavimacroyal.com',
  logo: '/logo.jpg',
  currency: 'Ghana Cedis (GH₵)'
};
```

## Data Requirements

- **Rooms** – Availability, pricing, and capacity details for occupancy calculations.
- **Reservations** – Booking status and stay dates to determine occupancy rates and guest counts.
- **Invoices** – Monetary transactions stored in Ghana Cedis used to compute revenue totals and breakdowns.
- **Tasks / Service Requests** – Operational metrics for housekeeping completion and guest satisfaction signals.

## Testing Checklist

1. Generate a monthly report for a period with known activity.
2. Verify that occupancy, guest totals, and revenue (GH₵) align with the data recorded in Supabase.
3. Inspect the exported PDF to confirm header/footer branding, section ordering, and the filename format `Nhyiraba_Hotel_{ReportType}_Report_{Timestamp}.pdf`.
4. Review browser logs for any Supabase permission warnings or data conversion errors.

## Customisation Guidance

- **New report types** – Extend the report switch statement, add a dedicated builder function, and define the Supabase queries for the new metrics.
- **Brand refresh** – Update `HOTEL_CONFIG` values and supporting assets (logo, colours) to reflect revised guidelines.
- **Performance tuning** – Maintain the parallel `Promise.all` fetching pattern and filter queries by date range to reduce payload size.

## Troubleshooting

- **Empty data sets** – Confirm the selected period contains transactions and that Row Level Security policies allow access.
- **Zero revenue** – Check that invoice `amount` fields store numeric values in Ghana Cedis and are not null.
- **Formatting issues** – Validate that the shared styling helpers are imported and that jsPDF assets (fonts, images) load correctly.

## Support Contact

For further assistance or enhancement requests, reach out to the Nhyiraba Hotel team:

- **Telephone**: +233(0)248676262
- **Email**: info.lavimacroyalhotel@gmail.com
- **Location**: Oduom Anwomaso, Ghana


