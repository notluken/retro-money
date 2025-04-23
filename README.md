# Excel 2.0 (1987) Style Expense Tracker & Todo List

A retro-styled web application that mimics the look and feel of Microsoft Excel 2.0 from 1987. This multi-function app includes expense tracking with budget management, as well as a comprehensive todo list with task management capabilities.

## Features

### Core Features
- Classic Excel 2.0 UI with grid interface, menus, and retro styling
- Responsive design that works on both desktop and mobile devices
- Persistent data storage with SQLite

### Expense Tracking
- Track expenses in USD and Argentine Pesos (ARS)
- Real-time currency conversion using dolarapi.com API
- Support for both "Dolar Blue" and "Dolar Tarjeta" exchange rates
- Categorize expenses into customizable budget categories
- View expenses in a spreadsheet-like interface

### Budget Management
- Set monthly salary and track remaining budget
- Implement the 30/20/30/20 budgeting rule (or customize allocations)
- Visual budget dashboard with category breakdowns
- Budget allocation adjustments with percentage controls
- Budget warnings when categories exceed allocation
- Graphical representation of budget vs. actual spending

### Todo List
- Create and manage tasks with due dates
- Support for nested subtasks (multi-level task hierarchies)
- Track time spent on tasks
- Copy tasks to other dates (with or without subtasks)
- Filter tasks by date
- Mark tasks as complete/incomplete
- Track completion statistics

### Technical Features
- No horizontal or vertical scrollbars (hidden but functional scrolling)
- Optimized for both desktop and mobile devices
- Offline-capable with local data caching
- Responsive layout with proper column alignment

## Requirements

- Python 3.10+
- Flask
- Requests library
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

### Expense Tracker

#### Setting Monthly Salary
- Enter your monthly salary in USD in the top input field and click "Save"

#### Adding Expenses
- Use the "Add Expense" form to enter:
  - Date
  - Description
  - Amount
  - Currency (USD Blue, USD Tarjeta, or ARS)
  - Category (Fixed Expenses, Guilt-Free Spending, Savings, Investments)
- Click "Add" to save the expense

#### Budget Management
- View your budget allocation in the Budget Dashboard
- Click "Adjust Budget Allocations" to modify category percentages
- Budget warnings appear when categories exceed allocation

#### Currency Conversion
- The application automatically fetches the current USD to ARS exchange rates
- Toggle between "Dolar Blue" and "Dolar Tarjeta" rates
- All expenses are shown in both currencies for convenience

### Todo List

#### Adding Tasks
- Enter task description and due date
- Click "Add" to create the task

#### Managing Tasks
- Use the checkboxes to mark tasks as complete/incomplete
- Add subtasks to create hierarchical task lists
- Track time spent on tasks with the timer icon
- Copy tasks to other dates with the clipboard icon
- Delete tasks with the X icon

#### Filtering Tasks
- View tasks for a specific date
- View all tasks in a comprehensive list

## Data Persistence
All data is stored in a local SQLite database (`expenses.db`) that is created automatically when you first run the application.

## API Integration
The application integrates with dolarapi.com to fetch real-time exchange rates for USD to ARS conversion. 