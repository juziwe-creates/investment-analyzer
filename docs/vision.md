# Investment Analyzer

## Tagline

**Analyze every investment. Measure every decision.**

---

# Mission

Investment Analyzer helps investors understand the performance of every investment decision they have made.

Unlike traditional broker dashboards, which primarily focus on portfolio value and current positions, Investment Analyzer provides decision-level analytics for every purchase, sale, and dividend received.

The goal is to answer questions such as:

- Which investment decisions generated the highest returns?
- Which purchases performed best on an annualized basis?
- How much dividend income has each investment generated?
- What is the current yield on cost of each investment?
- How much of my portfolio growth comes from capital appreciation versus dividends?
- How has my portfolio developed over time?

---

# Product Vision

Investment Analyzer is a portfolio analytics platform that enables investors to analyze their historical investment decisions using transaction-level data.

The system treats transactions as the source of truth and derives all portfolio analytics from those transactions.

The platform should support multiple brokers and data sources over time.

Examples:

- Comdirect
- Trade Republic
- Interactive Brokers
- CSV Import
- Manual Entry

The initial implementation will focus on Comdirect.

---

# Core Principles

## Transactions Are The Source Of Truth

The system stores individual transactions.

Examples:

- Buy transactions
- Sell transactions
- Dividend payments
- Fees
- Taxes

Portfolio positions and performance metrics are calculated from these transactions.

---

## Analytics Must Be Reproducible

Every displayed metric must be traceable back to underlying transactions.

Users should always be able to understand how a value was calculated.

---

## Holdings Are Calculated

The application should never store calculated holdings as master data.

Current holdings should be derived from transaction history.

---

## Auditability First

All imported data should be linked to its original source whenever possible.

Examples:

- Broker transaction
- Dividend payment
- Postbox document
- Imported CSV file

---

## Broker Independence

The application architecture should separate:

- Data ingestion
- Portfolio calculations
- Analytics
- User interface

This allows future support for additional brokers.

---

# Target Users

Individual investors who want deeper insight into their portfolio performance than what their broker provides.

Typical users:

- Long-term investors
- Dividend investors
- ETF investors
- Stock investors

---

# MVP Scope

## Authentication

- User registration
- User login
- User profile

Implementation:
- Supabase Auth

---

## Portfolio Data

Support:

- Securities
- Buy transactions
- Sell transactions
- Dividend payments

Data may initially be imported manually.

---

## Dashboard

Display:

- Current portfolio value
- Invested capital
- Total gain/loss
- Total dividends received

---

## Portfolio Development

Display portfolio performance over time.

Chart should show:

- Invested capital
- Portfolio value
- Capital gains
- Dividend income

Users should be able to understand how their wealth evolved over time.

---

## Transaction Analytics

For every purchase transaction (lot), calculate:

- Purchase date
- Purchase price
- Quantity
- Cost basis
- Current value
- Unrealized gain
- Unrealized gain percentage
- Annualized return

Example:

| Security | Buy Date | Cost Basis | Current Value | Gain % | Annualized Return |
|-----------|-----------|-----------|-----------|-----------|-----------|

---

## Dividend Analytics

For every purchase transaction (lot), calculate:

- Total dividends received
- Current annual dividend
- Yield on cost

Example:

| Security | Buy Date | Total Dividends | Yield on Cost |
|-----------|-----------|-----------|-----------|

---

# Future Roadmap

## Data Import

- Comdirect API integration
- Comdirect Postbox integration
- Automated synchronization
- Delta loads

---

## Advanced Analytics

- XIRR
- Benchmark comparison
- Portfolio attribution
- Dividend growth analysis
- Tax estimation

---

## Broker Support

- Trade Republic
- Interactive Brokers
- Additional brokers

---

# Technical Architecture

## Frontend

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

Deployment:
- Vercel

---

## Backend

- Supabase

Services:

- Authentication
- Database
- Storage

---

## Database

PostgreSQL

Primary entities:

- users
- securities
- transactions
- dividends
- prices
- portfolio_snapshots
- source_documents
- import_runs

---

## Service Layer

The application should contain a dedicated domain layer.

Examples:

- portfolioService
- transactionService
- dividendService
- performanceService
- importService
- marketDataService

Business logic should not be implemented directly inside UI components.

---

# Success Criteria For MVP

A user can:

1. Import investment transactions.
2. Import dividend transactions.
3. View portfolio development over time.
4. Distinguish invested capital from gains.
5. See dividend contributions.
6. Analyze the performance of every investment transaction.
7. Understand the impact of every investment decision.

---

# North Star

**Analyze every investment. Measure every decision.**