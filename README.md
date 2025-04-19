# Excel 2.0 (1987) Style Expense Tracker

A retro expense tracker web application that mimics the look and feel of Microsoft Excel 2.0 from 1987. This application allows users to track their expenses, convert between USD and Argentine Pesos using real-time exchange rates, and perform basic spreadsheet operations.

## Features

- Classic Excel 2.0 UI with grid interface, menus, and toolbars
- Expense tracking with USD and ARS support
- Real-time USD to ARS currency conversion using https://dolarapi.com/v1/dolares/blue API
- Basic formula support with cell references and SUM function
- Cell formatting (bold, italic, currency, percentage)
- Monthly salary tracking and budget calculation
- Persistent data storage with SQLite

## Requirements

- Python 3.10+
- Flask
- SQLite3 (included with Python)
- Modern web browser

## Installation

1. Clone this repository or download the source code

2. Install the required dependencies:
```
pip install flask requests
```

3. Initialize the database and start the application:
```
python app.py
```

4. Open your browser and navigate to:
```
http://127.0.0.1:5000
```

## Usage

### Setting Monthly Salary
- Enter your monthly salary in USD in the top input field and click "Save"

### Adding Expenses
- Use the "Add Expense" form to enter:
  - Date (defaults to today if left blank)
  - Description
  - Amount
  - Currency (USD or ARS)
- Click "Add" to save the expense

### Using the Spreadsheet
- Click on a cell to select it
- Double-click to edit a cell
- Type formulas starting with "=" (e.g., "=A2+B2" or "=SUM(A2:A5)")
- Use the toolbar buttons to format cells (bold, italic, currency, percentage)

### Deleting Expenses
- Click the "Delete" action in the rightmost column of the expense row

## Currency Conversion
The application automatically fetches the current USD to ARS exchange rate from the API and updates the display. All expenses are shown in both currencies for convenience.

## Data Persistence
All data is stored in a local SQLite database (`expenses.db`) that is created automatically when you first run the application. 