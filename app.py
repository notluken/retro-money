import os
import json
import sqlite3
import requests
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, redirect, url_for

app = Flask(__name__)

# Database setup
def init_db():
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    c.execute('''
    CREATE TABLE IF NOT EXISTS user_info (
        id INTEGER PRIMARY KEY,
        monthly_salary REAL
    )
    ''')
    c.execute('''
    CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        description TEXT,
        amount REAL,
        currency TEXT,
        category TEXT
    )
    ''')
    c.execute('''
    CREATE TABLE IF NOT EXISTS budget_categories (
        id INTEGER PRIMARY KEY,
        name TEXT, 
        percentage REAL
    )
    ''')
    c.execute('''
    CREATE TABLE IF NOT EXISTS budget_allocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month TEXT,
        category_id INTEGER,
        allocated_amount REAL,
        actual_amount REAL DEFAULT 0,
        FOREIGN KEY (category_id) REFERENCES budget_categories (id)
    )
    ''')
    
    # Check if todos table already exists
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='todos'")
    todos_exists = c.fetchone() is not None
    
    if not todos_exists:
        # Create todos table with parent_id for hierarchical structure
        c.execute('''
        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            created_date TEXT NOT NULL,
            completed_date TEXT,
            is_completed INTEGER DEFAULT 0,
            parent_id INTEGER DEFAULT NULL,
            level INTEGER DEFAULT 0,
            planned_date TEXT DEFAULT NULL,
            time_spent INTEGER DEFAULT 0,
            FOREIGN KEY (parent_id) REFERENCES todos (id) ON DELETE CASCADE
        )
        ''')
    else:
        # Check if we need to add new columns
        c.execute("PRAGMA table_info(todos)")
        columns = [col[1] for col in c.fetchall()]
        
        if "parent_id" not in columns:
            c.execute("ALTER TABLE todos ADD COLUMN parent_id INTEGER DEFAULT NULL")
            print("Added parent_id column to todos table")
            
        if "level" not in columns:
            c.execute("ALTER TABLE todos ADD COLUMN level INTEGER DEFAULT 0")
            print("Added level column to todos table")
            
        if "planned_date" not in columns:
            c.execute("ALTER TABLE todos ADD COLUMN planned_date TEXT DEFAULT NULL")
            print("Added planned_date column to todos table")
            
        if "time_spent" not in columns:
            c.execute("ALTER TABLE todos ADD COLUMN time_spent INTEGER DEFAULT 0")
            print("Added time_spent column to todos table")
    
    conn.commit()
    
    # Add default user info if not exists
    c.execute("SELECT COUNT(*) FROM user_info")
    if c.fetchone()[0] == 0:
        c.execute("INSERT INTO user_info (id, monthly_salary) VALUES (1, 0)")
        conn.commit()
    
    # Add default budget categories if not exists
    c.execute("SELECT COUNT(*) FROM budget_categories")
    if c.fetchone()[0] == 0:
        categories = [
            (1, "Fixed Expenses", 0.6),
            (2, "Guilt-Free Spending", 0.2),
            (3, "Savings", 0.1),
            (4, "Investments", 0.1)
        ]
        c.executemany("INSERT INTO budget_categories (id, name, percentage) VALUES (?, ?, ?)", categories)
        conn.commit()
    
    conn.close()

def migrate_data():
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    # Check if expenses table has category column
    c.execute("PRAGMA table_info(expenses)")
    columns = [col[1] for col in c.fetchall()]
    
    if 'category' not in columns:
        # Add category column to expenses table
        c.execute("ALTER TABLE expenses ADD COLUMN category TEXT DEFAULT 'Fixed Expenses'")
        conn.commit()
        print("Added category column to expenses table")
    
    # Assign all existing expenses to Fixed Expenses category (default)
    c.execute("UPDATE expenses SET category = 'Fixed Expenses' WHERE category IS NULL")
    conn.commit()
    print("Updated existing expenses with default category")
    
    # Initialize budget allocations for current month
    current_month = datetime.now().strftime("%Y-%m")
    
    # Get monthly salary
    c.execute("SELECT monthly_salary FROM user_info WHERE id = 1")
    monthly_salary = c.fetchone()[0]
    
    # Get budget categories
    c.execute("SELECT id, name, percentage FROM budget_categories")
    categories = c.fetchall()
    
    # For each category, set up allocation for current month
    for cat_id, cat_name, percentage in categories:
        # Calculate allocated amount
        allocated_amount = monthly_salary * percentage
        
        # Check if allocation exists
        c.execute(
            "SELECT COUNT(*) FROM budget_allocations WHERE month = ? AND category_id = ?",
            (current_month, cat_id)
        )
        
        if c.fetchone()[0] == 0:
            # Create new allocation, default actual to 0
            c.execute(
                "INSERT INTO budget_allocations (month, category_id, allocated_amount, actual_amount) VALUES (?, ?, ?, 0)",
                (current_month, cat_id, allocated_amount)
            )
    
    # Calculate actual amounts for each category
    c.execute("SELECT category, SUM(amount) FROM expenses GROUP BY category")
    category_totals = c.fetchall()
    
    for category, total in category_totals:
        # Get category ID
        c.execute("SELECT id FROM budget_categories WHERE name = ?", (category,))
        cat_id_result = c.fetchone()
        
        if cat_id_result:
            cat_id = cat_id_result[0]
            
            # Update all budgets for this category
            c.execute(
                "UPDATE budget_allocations SET actual_amount = ? WHERE category_id = ? AND month = ?",
                (total, cat_id, current_month)
            )
    
    conn.commit()
    conn.close()
    print("Migration complete")

# Routes
@app.route('/')
def index():
    return render_template('index.html', active_page="expenses")

@app.route('/todos')
def todos():
    return render_template('todos.html', active_page="todos")

@app.route('/api/salary', methods=['GET', 'POST'])
def salary():
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        new_salary = data.get('salary', 0)
        old_salary = 0
        
        # Get the old salary
        c.execute("SELECT monthly_salary FROM user_info WHERE id = 1")
        old_salary = c.fetchone()[0]
        
        # Update the salary
        c.execute("UPDATE user_info SET monthly_salary = ? WHERE id = 1", (new_salary,))
        conn.commit()
        
        # Get current month
        current_month = datetime.now().strftime("%Y-%m")
        
        # Recalculate budget allocations for the current month
        c.execute("SELECT id, percentage FROM budget_categories")
        for cat_id, percentage in c.fetchall():
            allocated_amount = new_salary * percentage
            
            # Check if an allocation exists for the current month
            c.execute(
                "SELECT id, allocated_amount, actual_amount FROM budget_allocations WHERE month = ? AND category_id = ?",
                (current_month, cat_id)
            )
            allocation = c.fetchone()
            
            if allocation:
                alloc_id, old_allocated, actual = allocation
                
                # If we have existing transactions, we need to recalculate proportionally
                if old_salary > 0 and actual > 0:
                    # Calculate the percentage of the actual spend relative to old allocation
                    proportion_spent = actual / old_allocated
                    
                    # Only adjust if the proportion is significant (to avoid division by zero issues)
                    if proportion_spent > 0:
                        # Determine if we need to adjust the actual spend
                        if new_salary > old_salary:
                            # If salary increased, keep actual the same
                            pass
                        else:
                            # If salary decreased and proportion spent is high, adjust actual proportionally
                            # but only if it would exceed the new allocation
                            if actual > allocated_amount:
                                # Ensure we don't reduce below what's already spent
                                new_actual = max(actual, allocated_amount)
                                c.execute(
                                    "UPDATE budget_allocations SET actual_amount = ? WHERE id = ?",
                                    (new_actual, alloc_id)
                                )
                
                # Update the allocated amount regardless
                c.execute(
                    "UPDATE budget_allocations SET allocated_amount = ? WHERE id = ?",
                    (allocated_amount, alloc_id)
                )
            else:
                # Create a new allocation
                c.execute(
                    "INSERT INTO budget_allocations (month, category_id, allocated_amount, actual_amount) VALUES (?, ?, ?, ?)",
                    (current_month, cat_id, allocated_amount, 0)
                )
        
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
    else:
        c.execute("SELECT monthly_salary FROM user_info WHERE id = 1")
        salary = c.fetchone()[0]
        conn.close()
        return jsonify({"salary": salary})

@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    c.execute("SELECT id, date, description, amount, currency, category FROM expenses ORDER BY date DESC")
    expenses = [
        {
            "id": row[0],
            "date": row[1],
            "description": row[2],
            "amount": row[3],
            "currency": row[4],
            "category": row[5]
        }
        for row in c.fetchall()
    ]
    conn.close()
    return jsonify(expenses)

@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    # First get the expense details for updating allocations
    c.execute("SELECT date, amount, currency, category FROM expenses WHERE id = ?", (expense_id,))
    expense = c.fetchone()
    
    if not expense:
        conn.close()
        return jsonify({"status": "error", "message": "Expense not found"}), 404
    
    date, amount, currency, category = expense
    current_month = "-".join(date.split("-")[:2])
    
    # Get category ID
    c.execute("SELECT id FROM budget_categories WHERE name = ?", (category,))
    category_id_result = c.fetchone()
    
    # Delete the expense
    c.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
    
    # Update budget allocation if applicable
    if category_id_result:
        category_id = category_id_result[0]
        
        # Convert amount to USD if needed
        amount_in_usd = amount
        if currency == 'ARS':
            # Get current exchange rate
            try:
                response = requests.get('https://dolarapi.com/v1/dolares/blue')
                if response.status_code == 200:
                    rate = response.json().get("venta", 1150)
                    amount_in_usd = amount / rate
                else:
                    # Fallback rate
                    amount_in_usd = amount / 1150
            except:
                # Fallback rate if API fails
                amount_in_usd = amount / 1150
        
        c.execute(
            "SELECT id, actual_amount FROM budget_allocations WHERE month = ? AND category_id = ?", 
            (current_month, category_id)
        )
        allocation = c.fetchone()
        
        if allocation:
            # Update allocation (subtract the deleted expense amount)
            new_amount = max(0, allocation[1] - amount_in_usd)  # Prevent negative values
            c.execute(
                "UPDATE budget_allocations SET actual_amount = ? WHERE id = ?",
                (new_amount, allocation[0])
            )
    
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})

# Backward compatibility route for DELETE
@app.route('/api/expenses', methods=['DELETE'])
def delete_expense_compat():
    data = request.json
    expense_id = data.get('id')
    
    if not expense_id:
        return jsonify({"status": "error", "message": "No ID provided"}), 400
    
    return delete_expense(expense_id)

@app.route('/api/exchange-rate/blue', methods=['GET'])
def exchange_rate_blue():
    try:
        response = requests.get('https://dolarapi.com/v1/dolares/blue')
        if response.status_code == 200:
            data = response.json()
            return jsonify({
                "usd_to_ars": data.get("venta", 0),
                "updated": data.get("fechaActualizacion", "")
            })
        else:
            return jsonify({"error": "Failed to fetch exchange rate"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/exchange-rate/tarjeta', methods=['GET'])
def exchange_rate_tarjeta():
    try:
        response = requests.get('https://dolarapi.com/v1/dolares/tarjeta')
        if response.status_code == 200:
            data = response.json()
            return jsonify({
                "usd_to_ars": data.get("venta", 0),
                "updated": data.get("fechaActualizacion", "")
            })
        else:
            return jsonify({"error": "Failed to fetch exchange rate"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Legacy endpoint for backward compatibility
@app.route('/api/exchange-rate', methods=['GET'])
def exchange_rate():
    return exchange_rate_blue()

@app.route('/api/expenses/<int:expense_id>', methods=['PUT'])
def update_expense(expense_id):
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    data = request.json
    date = data.get('date')
    description = data.get('description')
    amount = data.get('amount')
    currency = data.get('currency')
    category = data.get('category')
    
    # Get the old expense data for updating budget allocations
    c.execute("SELECT date, amount, currency, category FROM expenses WHERE id = ?", (expense_id,))
    old_expense = c.fetchone()
    
    if not old_expense:
        conn.close()
        return jsonify({"status": "error", "message": "Expense not found"}), 404
    
    old_date, old_amount, old_currency, old_category = old_expense
    old_month = "-".join(old_date.split("-")[:2])
    new_month = "-".join(date.split("-")[:2])
    
    try:
        # Update the expense
        c.execute(
            "UPDATE expenses SET date = ?, description = ?, amount = ?, currency = ?, category = ? WHERE id = ?",
            (date, description, amount, currency, category, expense_id)
        )
        
        # Convert old amount to USD if needed
        old_amount_in_usd = old_amount
        if old_currency == 'ARS':
            # Get current exchange rate
            try:
                response = requests.get('https://dolarapi.com/v1/dolares/blue')
                if response.status_code == 200:
                    rate = response.json().get("venta", 1150)
                    old_amount_in_usd = old_amount / rate
                else:
                    # Fallback rate
                    old_amount_in_usd = old_amount / 1150
            except:
                # Fallback rate if API fails
                old_amount_in_usd = old_amount / 1150
        
        # Convert new amount to USD if needed
        amount_in_usd = amount
        if currency == 'ARS':
            # Get current exchange rate
            try:
                response = requests.get('https://dolarapi.com/v1/dolares/blue')
                if response.status_code == 200:
                    rate = response.json().get("venta", 1150)
                    amount_in_usd = amount / rate
                else:
                    # Fallback rate
                    amount_in_usd = amount / 1150
            except:
                # Fallback rate if API fails
                amount_in_usd = amount / 1150
        
        # Update budget allocations - first remove from old category
        if old_category:
            c.execute("SELECT id FROM budget_categories WHERE name = ?", (old_category,))
            old_cat_id_result = c.fetchone()
            
            if old_cat_id_result:
                old_cat_id = old_cat_id_result[0]
                
                c.execute(
                    "SELECT id, actual_amount FROM budget_allocations WHERE month = ? AND category_id = ?", 
                    (old_month, old_cat_id)
                )
                old_allocation = c.fetchone()
                
                if old_allocation:
                    # Update allocation (subtract the old expense amount)
                    old_alloc_id, old_actual = old_allocation
                    new_amount = max(0, old_actual - old_amount_in_usd)  # Prevent negative values
                    c.execute(
                        "UPDATE budget_allocations SET actual_amount = ? WHERE id = ?",
                        (new_amount, old_alloc_id)
                    )
        
        # Then add to new category
        if category:
            c.execute("SELECT id FROM budget_categories WHERE name = ?", (category,))
            new_cat_id_result = c.fetchone()
            
            if new_cat_id_result:
                new_cat_id = new_cat_id_result[0]
                
                c.execute(
                    "SELECT id, actual_amount FROM budget_allocations WHERE month = ? AND category_id = ?", 
                    (new_month, new_cat_id)
                )
                new_allocation = c.fetchone()
                
                if new_allocation:
                    # Update existing allocation
                    new_alloc_id, new_actual = new_allocation
                    updated_amount = new_actual + amount_in_usd
                    c.execute(
                        "UPDATE budget_allocations SET actual_amount = ? WHERE id = ?",
                        (updated_amount, new_alloc_id)
                    )
                else:
                    # Create new allocation record for this month
                    c.execute("SELECT monthly_salary FROM user_info WHERE id = 1")
                    monthly_salary = c.fetchone()[0]
                    
                    c.execute("SELECT percentage FROM budget_categories WHERE id = ?", (new_cat_id,))
                    percentage = c.fetchone()[0]
                    
                    allocated_amount = monthly_salary * percentage
                    
                    c.execute(
                        "INSERT INTO budget_allocations (month, category_id, allocated_amount, actual_amount) VALUES (?, ?, ?, ?)",
                        (new_month, new_cat_id, allocated_amount, amount_in_usd)
                    )
        
        conn.commit()
        
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        conn.close()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/budget-allocations', methods=['GET'])
def budget_allocations():
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    # Get query parameters or use current month
    month = request.args.get('month')
    if not month:
        # Default to current month
        month = datetime.now().strftime("%Y-%m")
    
    # Get the monthly salary
    c.execute("SELECT monthly_salary FROM user_info WHERE id = 1")
    monthly_salary = c.fetchone()[0]
    
    # Get current exchange rates for conversions
    try:
        blue_response = requests.get('https://dolarapi.com/v1/dolares/blue')
        tarjeta_response = requests.get('https://dolarapi.com/v1/dolares/tarjeta')
        
        blue_rate = blue_response.json().get("venta", 1150) if blue_response.status_code == 200 else 1150
        tarjeta_rate = tarjeta_response.json().get("venta", 1150) if tarjeta_response.status_code == 200 else 1150
    except:
        # Fallback rates if API fails
        blue_rate = 1150
        tarjeta_rate = 1150
    
    # Get all budget categories
    c.execute("SELECT id, name, percentage FROM budget_categories")
    categories = c.fetchall()
    
    # Build the response data
    allocations = []
    total_actual = 0
    
    for cat_id, cat_name, percentage in categories:
        # Calculate allocated amount for this category
        allocated = monthly_salary * percentage
        
        # Get actual expenses for this category directly from expenses table
        c.execute("""
            SELECT e.amount, e.currency 
            FROM expenses e 
            WHERE e.category = ? AND strftime('%Y-%m', e.date) = ?
        """, (cat_name, month))
        
        expenses_result = c.fetchall()
        
        # Calculate actual spend in USD
        actual = 0
        for amount, currency in expenses_result:
            if currency == 'ARS':
                # Convert ARS to USD using blue rate
                if blue_rate > 0:
                    # Make sure to store the USD equivalent
                    actual += amount / blue_rate
            elif currency == 'USD-Blue' or currency == 'USD':
                # Already in USD
                actual += amount
            elif currency == 'USD-Tarjeta':
                # Already in USD
                actual += amount
        
        # Get any existing budget allocation record
        c.execute(
            "SELECT id FROM budget_allocations WHERE month = ? AND category_id = ?", 
            (month, cat_id)
        )
        allocation_record = c.fetchone()
        
        # Update the budget allocation with the calculated amount
        if allocation_record:
            c.execute(
                "UPDATE budget_allocations SET actual_amount = ? WHERE id = ?",
                (actual, allocation_record[0])
            )
        else:
            c.execute(
                "INSERT INTO budget_allocations (month, category_id, allocated_amount, actual_amount) VALUES (?, ?, ?, ?)",
                (month, cat_id, allocated, actual)
            )
        
        conn.commit()
        
        total_actual += actual
        
        # Calculate remaining balance
        remaining = allocated - actual
        
        # Check if over budget
        is_over_budget = remaining < 0
        
        # Check if would exceed 120% limit
        exceeds_limit = actual > (allocated * 1.2)
        
        allocations.append({
            "id": cat_id,
            "name": cat_name,
            "percentage": percentage * 100,  # Convert to percentage for display
            "allocated": allocated,
            "actual": actual,
            "remaining": remaining,
            "is_over_budget": is_over_budget,
            "exceeds_limit": exceeds_limit
        })
    
    # Calculate overall budget summary
    total_allocated = monthly_salary
    total_remaining = total_allocated - total_actual
    
    response = {
        "month": month,
        "salary": monthly_salary,
        "total_allocated": total_allocated,
        "total_actual": total_actual,
        "total_remaining": total_remaining,
        "allocations": allocations
    }
    
    conn.close()
    return jsonify(response)

@app.route('/api/budget-categories', methods=['GET'])
def budget_categories():
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    c.execute("SELECT id, name, percentage FROM budget_categories")
    categories = [
        {
            "id": row[0],
            "name": row[1],
            "percentage": row[2] * 100  # Convert to percentage for display
        }
        for row in c.fetchall()
    ]
    
    conn.close()
    return jsonify(categories)

@app.route('/api/budget-allocations/redistribute', methods=['POST'])
def redistribute_budget():
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    data = request.json
    adjustments = data.get('adjustments', [])
    month = data.get('month', datetime.now().strftime("%Y-%m"))
    
    # Validate total percentage still equals 100%
    total_percentage = 0
    for adj in adjustments:
        total_percentage += adj.get('percentage', 0) / 100  # Convert from percentage to decimal
    
    if abs(total_percentage - 1.0) > 0.01:  # Allow small rounding errors
        conn.close()
        return jsonify({
            "status": "error", 
            "message": "Total percentage must equal 100%"
        }), 400
    
    # Update categories
    for adj in adjustments:
        cat_id = adj.get('id')
        percentage = adj.get('percentage') / 100  # Convert from percentage to decimal
        
        c.execute(
            "UPDATE budget_categories SET percentage = ? WHERE id = ?",
            (percentage, cat_id)
        )
    
    # Get the monthly salary
    c.execute("SELECT monthly_salary FROM user_info WHERE id = 1")
    monthly_salary = c.fetchone()[0]
    
    # Recalculate all allocations for the current month
    c.execute("SELECT id, percentage FROM budget_categories")
    for cat_id, percentage in c.fetchall():
        allocated_amount = monthly_salary * percentage
        
        # Check if an allocation already exists for this month
        c.execute(
            "SELECT id FROM budget_allocations WHERE month = ? AND category_id = ?",
            (month, cat_id)
        )
        allocation = c.fetchone()
        
        if allocation:
            # Update existing allocation
            c.execute(
                "UPDATE budget_allocations SET allocated_amount = ? WHERE id = ?",
                (allocated_amount, allocation[0])
            )
        else:
            # Create new allocation
            c.execute(
                "INSERT INTO budget_allocations (month, category_id, allocated_amount, actual_amount) VALUES (?, ?, ?, ?)",
                (month, cat_id, allocated_amount, 0)
            )
    
    conn.commit()
    conn.close()
    
    return jsonify({"status": "success"})

@app.route('/api/expenses', methods=['POST'])
def add_expense():
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    data = request.json
    date = data.get('date', datetime.now().strftime("%Y-%m-%d"))
    description = data.get('description', '')
    amount = data.get('amount', 0)
    currency = data.get('currency', 'USD')
    category = data.get('category', 'Fixed Expenses')  # Default to Fixed Expenses if not specified
    
    # Validate amount
    try:
        amount = float(amount)
        if amount <= 0:
            return jsonify({"status": "error", "message": "Amount must be positive"}), 400
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid amount"}), 400
    
    # Insert the expense
    c.execute(
        "INSERT INTO expenses (date, description, amount, currency, category) VALUES (?, ?, ?, ?, ?)",
        (date, description, amount, currency, category)
    )
    conn.commit()
    last_id = c.lastrowid
    
    # Get the current month in YYYY-MM format
    current_month = "-".join(date.split("-")[:2])
    
    # Update budget allocation for this category
    c.execute("SELECT id FROM budget_categories WHERE name = ?", (category,))
    category_id = c.fetchone()
    
    if category_id:
        category_id = category_id[0]
        
        # Check if there's an allocation record for this month and category
        c.execute(
            "SELECT id, actual_amount FROM budget_allocations WHERE month = ? AND category_id = ?", 
            (current_month, category_id)
        )
        allocation = c.fetchone()
        
        # Convert amount to USD if needed
        amount_in_usd = amount
        if currency == 'ARS':
            # Get current exchange rate
            try:
                response = requests.get('https://dolarapi.com/v1/dolares/blue')
                if response.status_code == 200:
                    rate = response.json().get("venta", 1150)
                    amount_in_usd = amount / rate
                else:
                    # Fallback rate
                    amount_in_usd = amount / 1150
            except:
                # Fallback rate if API fails
                amount_in_usd = amount / 1150
        
        if allocation:
            # Update existing allocation
            new_amount = allocation[1] + amount_in_usd
            c.execute(
                "UPDATE budget_allocations SET actual_amount = ? WHERE id = ?",
                (new_amount, allocation[0])
            )
        else:
            # Create new allocation record for this month
            c.execute("SELECT monthly_salary FROM user_info WHERE id = 1")
            monthly_salary = c.fetchone()[0]
            
            c.execute("SELECT percentage FROM budget_categories WHERE id = ?", (category_id,))
            percentage = c.fetchone()[0]
            
            allocated_amount = monthly_salary * percentage
            
            c.execute(
                "INSERT INTO budget_allocations (month, category_id, allocated_amount, actual_amount) VALUES (?, ?, ?, ?)",
                (current_month, category_id, allocated_amount, amount_in_usd)
            )
    
    conn.commit()
    conn.close()
    return jsonify({"id": last_id, "status": "success"})

@app.route('/api/todos', methods=['GET'])
def get_todos():
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    # Get date filter from query parameters
    date_filter = request.args.get('date', None)
    
    query = """
        SELECT id, description, created_date, completed_date, is_completed, parent_id, level, planned_date, time_spent 
        FROM todos 
    """
    
    params = []
    
    # Apply date filter if provided
    if date_filter:
        query += " WHERE planned_date = ? OR planned_date IS NULL"
        params.append(date_filter)
    
    query += " ORDER BY level, parent_id NULLS FIRST, is_completed, created_date DESC"
    
    c.execute(query, params)
    
    rows = c.fetchall()
    todos = []
    
    # First build a flat list of todos
    for row in rows:
        todo = {
            "id": row[0],
            "description": row[1],
            "created_date": row[2],
            "completed_date": row[3],
            "is_completed": bool(row[4]),
            "parent_id": row[5],
            "level": row[6],
            "planned_date": row[7],
            "time_spent": row[8],
            "subtasks": []  # Will hold subtasks if any
        }
        todos.append(todo)
    
    conn.close()
    
    # Flat structure is easier to work with for the client
    return jsonify(todos)

@app.route('/api/todos', methods=['POST'])
def add_todo():
    data = request.json
    description = data.get('description', '')
    parent_id = data.get('parent_id', None)
    planned_date = data.get('planned_date', None)
    
    if not description:
        return jsonify({"status": "error", "message": "Description is required"}), 400
    
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    now = datetime.now().strftime("%Y-%m-%d")
    
    # Default level is 0 (top-level task)
    level = 0
    
    # If this is a subtask, get the parent's level and increment
    if parent_id:
        # Validate parent_id exists
        c.execute("SELECT id, level FROM todos WHERE id = ?", (parent_id,))
        parent = c.fetchone()
        
        if not parent:
            conn.close()
            return jsonify({"status": "error", "message": "Parent task not found"}), 404
        
        # Set level as parent level + 1
        level = parent[1] + 1
    
    # Insert the new todo with hierarchical info
    c.execute(
        "INSERT INTO todos (description, created_date, is_completed, parent_id, level, planned_date) VALUES (?, ?, ?, ?, ?, ?)",
        (description, now, 0, parent_id, level, planned_date)
    )
    
    todo_id = c.lastrowid
    conn.commit()
    
    new_todo = {
        "id": todo_id,
        "description": description,
        "created_date": now,
        "completed_date": None,
        "is_completed": False,
        "parent_id": parent_id,
        "level": level,
        "planned_date": planned_date,
        "time_spent": 0,
        "subtasks": []
    }
    
    conn.close()
    return jsonify({"status": "success", "todo": new_todo})

@app.route('/api/todos/<int:todo_id>/toggle', methods=['POST'])
def toggle_todo(todo_id):
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    # Get current todo state
    c.execute("SELECT is_completed, level FROM todos WHERE id = ?", (todo_id,))
    result = c.fetchone()
    
    if not result:
        conn.close()
        return jsonify({"status": "error", "message": "Todo not found"}), 404
    
    is_completed = not bool(result[0])
    completed_date = datetime.now().strftime("%Y-%m-%d") if is_completed else None
    
    # Update this todo
    c.execute(
        "UPDATE todos SET is_completed = ?, completed_date = ? WHERE id = ?",
        (1 if is_completed else 0, completed_date, todo_id)
    )
    
    # If completing a task, also complete all subtasks
    if is_completed:
        # Use recursive CTE to find all descendant tasks
        c.execute("""
            WITH RECURSIVE subtasks(id) AS (
                SELECT id FROM todos WHERE parent_id = ?
                UNION ALL
                SELECT t.id FROM todos t, subtasks s WHERE t.parent_id = s.id
            )
            UPDATE todos SET 
                is_completed = 1, 
                completed_date = ? 
            WHERE id IN subtasks
        """, (todo_id, completed_date))
    
    conn.commit()
    
    # Get updated todos to return
    c.execute("""
        SELECT id, is_completed, completed_date 
        FROM todos 
        WHERE id = ? OR parent_id = ?
    """, (todo_id, todo_id))
    
    updated_todos = [
        {
            "id": row[0],
            "is_completed": bool(row[1]),
            "completed_date": row[2]
        }
        for row in c.fetchall()
    ]
    
    conn.close()
    
    return jsonify({
        "status": "success",
        "updated_todos": updated_todos
    })

@app.route('/api/todos/<int:todo_id>', methods=['DELETE'])
def delete_todo(todo_id):
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    # Find and delete all subtasks
    try:
        # Use recursive CTE to find all descendant tasks
        c.execute("""
            WITH RECURSIVE subtasks(id) AS (
                SELECT id FROM todos WHERE id = ?
                UNION ALL
                SELECT t.id FROM todos t, subtasks s WHERE t.parent_id = s.id
            )
            DELETE FROM todos WHERE id IN subtasks
        """, (todo_id,))
        
        deleted_count = c.rowcount
        
        if deleted_count == 0:
            conn.close()
            return jsonify({"status": "error", "message": "Todo not found"}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "status": "success", 
            "deleted_count": deleted_count
        })
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/todos/stats/weekly', methods=['GET'])
def get_weekly_stats():
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    # Get the date for 7 days ago
    today = datetime.now()
    seven_days_ago = (today - timedelta(days=6)).strftime("%Y-%m-%d")
    today_str = today.strftime("%Y-%m-%d")
    
    # Generate a list of dates for the last 7 days
    dates = []
    date_obj = today - timedelta(days=6)
    for _ in range(7):
        dates.append(date_obj.strftime("%Y-%m-%d"))
        date_obj += timedelta(days=1)
    
    # Get completed tasks in the last 7 days
    c.execute(
        "SELECT completed_date, COUNT(*) FROM todos WHERE completed_date >= ? AND completed_date <= ? GROUP BY completed_date",
        (seven_days_ago, today_str)
    )
    
    # Create a dictionary of completed tasks by date
    completed_by_date = {row[0]: row[1] for row in c.fetchall()}
    
    # Create the final result
    result = []
    for date in dates:
        result.append({
            "date": date,
            "completed": completed_by_date.get(date, 0)
        })
    
    conn.close()
    return jsonify(result)

@app.route('/api/todos/<int:todo_id>/copy', methods=['POST'])
def copy_todo(todo_id):
    data = request.json
    target_date = data.get('target_date')
    
    if not target_date:
        return jsonify({"status": "error", "message": "Target date is required"}), 400
    
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    # Get the todo to copy
    c.execute(
        "SELECT description, parent_id, level FROM todos WHERE id = ?", 
        (todo_id,)
    )
    todo = c.fetchone()
    
    if not todo:
        conn.close()
        return jsonify({"status": "error", "message": "Todo not found"}), 404
    
    description, parent_id, level = todo
    
    # Insert the new todo with the target date
    now = datetime.now().strftime("%Y-%m-%d")
    
    c.execute(
        "INSERT INTO todos (description, created_date, is_completed, parent_id, level, planned_date) VALUES (?, ?, ?, ?, ?, ?)",
        (description, now, 0, parent_id, level, target_date)
    )
    
    new_todo_id = c.lastrowid
    
    # If this was a parent task, check if we need to copy its subtasks
    if data.get('copy_subtasks', False):
        # Find all immediate subtasks
        c.execute(
            "SELECT id, description, level FROM todos WHERE parent_id = ?",
            (todo_id,)
        )
        
        subtasks = c.fetchall()
        
        # Copy each subtask with the new parent_id
        for subtask_id, subtask_desc, subtask_level in subtasks:
            c.execute(
                "INSERT INTO todos (description, created_date, is_completed, parent_id, level, planned_date) VALUES (?, ?, ?, ?, ?, ?)",
                (subtask_desc, now, 0, new_todo_id, subtask_level, target_date)
            )
    
    conn.commit()
    
    # Get the new todo with all info
    c.execute(
        "SELECT id, description, created_date, completed_date, is_completed, parent_id, level, planned_date, time_spent FROM todos WHERE id = ?",
        (new_todo_id,)
    )
    
    row = c.fetchone()
    new_todo = {
        "id": row[0],
        "description": row[1],
        "created_date": row[2],
        "completed_date": row[3],
        "is_completed": bool(row[4]),
        "parent_id": row[5],
        "level": row[6],
        "planned_date": row[7],
        "time_spent": row[8],
        "subtasks": []
    }
    
    conn.close()
    return jsonify({"status": "success", "todo": new_todo})

@app.route('/api/todos/<int:todo_id>/time', methods=['POST'])
def update_time_spent(todo_id):
    data = request.json
    time_spent = data.get('time_spent', 0)
    
    if time_spent < 0:
        return jsonify({"status": "error", "message": "Time spent cannot be negative"}), 400
    
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    # Update the time spent
    c.execute(
        "UPDATE todos SET time_spent = ? WHERE id = ?",
        (time_spent, todo_id)
    )
    
    if c.rowcount == 0:
        conn.close()
        return jsonify({"status": "error", "message": "Todo not found"}), 404
    
    conn.commit()
    conn.close()
    
    return jsonify({"status": "success"})

@app.route('/api/todos/<int:todo_id>/plan', methods=['POST'])
def update_planned_date(todo_id):
    data = request.json
    planned_date = data.get('planned_date')
    
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    # Update the planned date
    c.execute(
        "UPDATE todos SET planned_date = ? WHERE id = ?",
        (planned_date, todo_id)
    )
    
    if c.rowcount == 0:
        conn.close()
        return jsonify({"status": "error", "message": "Todo not found"}), 404
    
    conn.commit()
    conn.close()
    
    return jsonify({"status": "success"})

# Initialize the database
init_db()

if __name__ == '__main__':
    migrate_data()
    app.run(port=8092, host='0.0.0.0') 