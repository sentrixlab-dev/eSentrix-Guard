# Implementation Plan - Customer Data Checker Improvements

This document outlines the strategy for analyzing, refactoring, and optimizing the AI Customer Data Checker.

## User Review Required

> [!IMPORTANT]
> **Plan and Research Phase**: We are currently in planning mode. Do not execute any implementation steps or code modifications until the plan has been reviewed and approved.

## 1. UI Redesign Plan

We will improve the UI layout to look clean, premium, and fully responsive based on modern design standards.
- Once you provide the custom design image or specific styling guidelines, we will create a tailored proposal for `style.css` and `index.html` changes.
- We will draft clean layouts for features including:
  - Scanner dashboard (manual check & queue list check)
  - Real-time progress bars and status logs
  - Database viewer with search and delete functions
  - Admin user management panels

---

## 2. Scanning Efficiency & Match Optimization (Phone Generation Strategy)

**The Problem:**
Generating purely random 11-digit numbers has an extremely low hit rate. Searching 100,000,000 possibilities when only a fraction has order history results in massive rate limits, bans, and zero useful data.

### Proposed Solutions for Smart Matching:
To maximize hit rate, we need structured or realistic number generation instead of pure randomness.

1. **Known Prefix & Active Range Analysis:**
   - Operators in Bangladesh assign numbers in blocks (e.g., Grameenphone `01711XXXXXX` to `01719XXXXXX`). We can allow users to specify specific series ranges where active eCommerce shoppers are concentrated.

2. **Database Seeded / Customer List Upload (Excel-driven):**
   - Instead of checking random numbers, the tool is best used by uploading existing lists of phone numbers (e.g., from an order list, checkout list, or abandoned cart list) to check their reliability before processing their deliveries. We should emphasize this workflow in the UI.

3. **Courier Service API Scraping Logic Analysis:**
   - How does `fraudChecker.js` currently fetch data? We need to inspect `fraudChecker.js` to see if it queries APIs that support wildcard searches or if we can extract lists of known problematic numbers.
   - Let's check `fraudChecker.js` next during the research phase.

---

## Verification Plan

### Manual Verification
- We will test the random generator with range/prefix constraints.
- We will verify that UI updates render correctly on desktop and mobile screens.
- We will ensure Socket.io updates correctly push progress states.
