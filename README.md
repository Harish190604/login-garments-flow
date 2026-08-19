# Login Garments Pro

Login Garments — Billing & Inventory Management System

You are an expert Product Designer, UI/UX Designer, Software Architect, and Full Stack Engineer.

Design and build a production-ready Billing & Inventory Management System for a men's clothing retail business called Login Garments.

The application should be modern, fast, responsive, scalable, and easy for non-technical staff to use.

Business Information

Business Name

Login Garments

Branches

Madurai

Thondi

Business Type

Men's Clothing

Fashion Accessories

Technology Stack

Frontend

React

TypeScript

Tailwind CSS

shadcn/ui

Backend

FastAPI

PostgreSQL (Supabase)

Deployment

Frontend → Vercel

Backend → Render

Database → Supabase

Design Requirements

Design a clean POS-style interface inspired by modern retail software.

The UI should be:

Modern

Professional

Minimal

Fast

Mobile responsive

Tablet friendly

Desktop optimized

Use soft colors with excellent readability.

Provide light mode by default and support dark mode.

Use cards, tables, charts, dialogs, badges, and modern forms throughout the application.

User Roles

Admin

Full system access

Manager

Inventory

Reports

Products

Suppliers

Customers

Billing

Stock Transfer

Cashier

Billing

Customer Lookup

Payment Collection

Dashboard

Create a beautiful dashboard displaying:

Today's Sales

Weekly Sales

Monthly Sales

Total Profit

Branch Comparison

Low Stock Alerts

Out of Stock Products

Pending Debts

Top Selling Products

Recent Transactions

Sales Charts

Inventory Overview

Branch Management

Manage branches:

Madurai

Thondi

The system should allow adding future branches.

Category Management

Create, edit, delete, and search product categories.

Product Management

Each product should include:

SKU

Barcode (optional)

Product Name

Category

Brand

Color

Size

Supplier

Purchase Price

Selling Price

GST %

Discount %

Profit (calculated automatically)

Current Stock

Minimum Stock

Branch

Features:

Search

Filters

Pagination

Barcode support

Stock status indicators

Supplier Management

Manage suppliers.

Include:

Supplier Details

Contact Information

Purchase History

Customer Management

Each customer should have:

Profile

Purchase History

Loyalty Points

Outstanding Debt

Payment History

Billing / POS

Design a modern POS screen.

Features:

Barcode Search

Product Search

Cart

Quantity Update

Discount

GST Calculation

Payment Methods:

Cash

UPI

Card

Cash + UPI

Cash + Card

UPI + Card

Partial Payment

Remaining Balance as Debt

Generate:

Printable Invoice

PDF Invoice

Invoice Reprint

Automatically reduce inventory after billing.

Inventory

Support:

Add Stock

Remove Stock

Stock Adjustment

Damaged Stock

Maintain complete inventory history.

Stock Transfer

Allow inventory transfer between:

Madurai

Thondi

Automatically:

Reduce source inventory

Increase destination inventory

Save transfer history

Debt Management

Support:

Partial Payments

Outstanding Balance

Payment History

Settlement Status

Reports

Generate reports for:

Daily Sales

Monthly Sales

GST

Profit

Inventory

Branch-wise Sales

Allow PDF export.

Analytics

Display:

Daily Sales

Weekly Sales

Monthly Sales

Best Selling Products

Least Selling Products

Branch Performance

Profit Trends

Use attractive charts and visual analytics.

AI Sales Insights (Optional)

Add an AI Insights page that analyzes sales history and recommends:

Slow-moving products

Restocking suggestions

Combo offers

Seasonal trends

Best-selling categories

Sales summaries

Database

Create a normalized PostgreSQL database with relationships for:

Users

Roles

Branches

Categories

Products

Suppliers

Customers

Inventory

Sales

Sale Items

Payments

Debts

Debt Payments

Stock Transfers

Stock Logs

Purchases

Use proper foreign keys and indexes.

Application Pages

Create pages for:

Login

Dashboard

Products

Categories

Inventory

Suppliers

Customers

Billing (POS)

Stock Transfer

Debts

Reports

Analytics

AI Insights

Settings

User Management

Profile

Not Found (404)

Components

Create reusable components including:

Sidebar

Top Navigation

KPI Cards

Data Tables

Search Bars

Filters

Forms

Dialogs

Charts

Invoice Preview

Product Cards

Branch Selector

Status Badges

Pagination

Loading Skeletons

Empty States

Confirmation Dialogs

Business Logic

Implement:

Inventory synchronization

GST calculation

Profit calculation

Automatic stock deduction after billing

Branch-wise inventory management

Debt tracking

Payment history

Stock transfer workflow

Loyalty points calculation

Quality Requirements

The application must be:

Production-ready

Modular

Responsive

Accessible

Scalable

Secure

Easy to maintain

Easy to extend

Use modern UI/UX best practices throughout the application.

Focus on creating a polished retail software experience rather than a basic CRUD application.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9d8edea0-20be-4bfe-9056-608874d11dbd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
