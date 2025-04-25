import os
import json
import sqlite3
import requests
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, redirect, url_for
from urllib.parse import urlencode
import random
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

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
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS investments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        purchase_date TEXT NOT NULL,
        purchase_price REAL NOT NULL,
        quantity REAL NOT NULL,
        current_price REAL DEFAULT 0,
        last_updated TEXT,
        notes TEXT,
        investment_type TEXT
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

@app.route('/investments')
def investments():
    return render_template('investments.html', active_page="investments")

@app.route('/transfers')
def transfers():
    return render_template('transfers.html', active_page='transfers')

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
    
    # If expense was in ARS, we need to restore the balance in the Belo account
    if currency == 'ARS':
        try:
            # Get current exchange rate from cripto API
            try:
                response = requests.get('https://dolarapi.com/v1/dolares/cripto')
                if response.status_code == 200:
                    # Use "compra" rate (when buying ARS / selling USD)
                    rate = response.json().get("compra", 1225)
                else:
                    rate = 1225
            except Exception as e:
                print(f"Error getting exchange rate: {str(e)}")
                rate = 1225
            
            # Calculate USD equivalent of the ARS expense
            usd_amount = amount / rate
            
            # Update Belo account to refund the amount
            c.execute("SELECT id, balance FROM accounts WHERE name = 'Belo'")
            belo_account = c.fetchone()
            
            if belo_account:
                belo_id, belo_balance = belo_account
                new_belo_balance = belo_balance + usd_amount
                c.execute("UPDATE accounts SET balance = ? WHERE id = ?", (new_belo_balance, belo_id))
            
            # Also update ARS account to reflect the refund
            c.execute("SELECT id, balance FROM accounts WHERE currency = 'ARS'")
            ars_account = c.fetchone()
            
            if ars_account:
                ars_id, ars_balance = ars_account
                new_ars_balance = ars_balance + amount
                c.execute("UPDATE accounts SET balance = ? WHERE id = ?", (new_ars_balance, ars_id))
        except Exception as e:
            print(f"Error updating account balances for deleted ARS expense: {str(e)}")
            # Continue with expense deletion even if account update fails
    
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
                response = requests.get('https://dolarapi.com/v1/dolares/cripto')
                if response.status_code == 200:
                    rate = response.json().get("compra", 1225)
                    amount_in_usd = amount / rate
                else:
                    # Fallback rate
                    amount_in_usd = amount / 1225
            except:
                # Fallback rate if API fails
                amount_in_usd = amount / 1225
        
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
        # Handle ARS currency changes for Belo account
        # Case 1: Was ARS before -> Need to restore USD in Belo account
        if old_currency == 'ARS':
            try:
                response = requests.get('https://dolarapi.com/v1/dolares/cripto')
                if response.status_code == 200:
                    old_rate = response.json().get("compra", 1225)
                else:
                    old_rate = 1225
                
                # Calculate the USD that was deducted
                old_usd_amount = old_amount / old_rate
                
                # Refund the Belo account
                c.execute("SELECT id, balance FROM accounts WHERE name = 'Belo'")
                belo_account = c.fetchone()
                
                if belo_account:
                    belo_id, belo_balance = belo_account
                    # Refund the old amount
                    updated_belo_balance = belo_balance + old_usd_amount
                    c.execute("UPDATE accounts SET balance = ? WHERE id = ?", (updated_belo_balance, belo_id))
                    
                    # Also update ARS account
                    c.execute("SELECT id, balance FROM accounts WHERE currency = 'ARS'")
                    ars_account = c.fetchone()
                    
                    if ars_account:
                        ars_id, ars_balance = ars_account
                        # Add the amount back
                        updated_ars_balance = ars_balance + old_amount
                        c.execute("UPDATE accounts SET balance = ? WHERE id = ?", (updated_ars_balance, ars_id))
            except Exception as e:
                print(f"Error refunding Belo account for old ARS expense: {str(e)}")
        
        # Case 2: Is ARS now -> Need to deduct USD from Belo account
        if currency == 'ARS':
            try:
                response = requests.get('https://dolarapi.com/v1/dolares/cripto')
                if response.status_code == 200:
                    new_rate = response.json().get("compra", 1225)
                else:
                    new_rate = 1225
                
                # Calculate new USD amount to deduct
                new_usd_amount = amount / new_rate
                
                # Update Belo account
                c.execute("SELECT id, balance FROM accounts WHERE name = 'Belo'")
                belo_account = c.fetchone()
                
                if belo_account:
                    belo_id, belo_balance = belo_account
                    
                    # If we already refunded from Case 1, use updated balance
                    if old_currency == 'ARS':
                        # We already refunded, now deduct the new amount
                        new_belo_balance = updated_belo_balance - new_usd_amount
                    else:
                        # Deduct from current balance
                        new_belo_balance = belo_balance - new_usd_amount
                    
                    # Verify sufficient balance
                    if new_belo_balance < 0:
                        conn.close()
                        return jsonify({"status": "error", "message": "Insufficient balance in Belo account for this expense"}), 400
                    
                    c.execute("UPDATE accounts SET balance = ? WHERE id = ?", (new_belo_balance, belo_id))
                    
                    # Also update ARS account
                    c.execute("SELECT id, balance FROM accounts WHERE currency = 'ARS'")
                    ars_account = c.fetchone()
                    
                    if ars_account:
                        ars_id, ars_balance = ars_account
                        
                        if old_currency == 'ARS':
                            # We already added old amount back, now deduct new amount
                            new_ars_balance = updated_ars_balance - amount
                        else:
                            # Just deduct from current balance
                            new_ars_balance = ars_balance - amount
                            
                        c.execute("UPDATE accounts SET balance = ? WHERE id = ?", (new_ars_balance, ars_id))
            except Exception as e:
                print(f"Error updating Belo account for new ARS expense: {str(e)}")
                # Continue with expense update
        
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
                response = requests.get('https://dolarapi.com/v1/dolares/cripto')
                if response.status_code == 200:
                    rate = response.json().get("compra", 1225)
                    old_amount_in_usd = old_amount / rate
                else:
                    # Fallback rate
                    old_amount_in_usd = old_amount / 1225
            except:
                # Fallback rate if API fails
                old_amount_in_usd = old_amount / 1225
        
        # Convert new amount to USD if needed
        amount_in_usd = amount
        if currency == 'ARS':
            # Get current exchange rate
            try:
                response = requests.get('https://dolarapi.com/v1/dolares/cripto')
                if response.status_code == 200:
                    rate = response.json().get("compra", 1225)
                    amount_in_usd = amount / rate
                else:
                    # Fallback rate
                    amount_in_usd = amount / 1225
            except:
                # Fallback rate if API fails
                amount_in_usd = amount / 1225
        
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
        # Handle all currencies correctly
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
    
    print(f"Received budget redistribution request: {len(adjustments)} categories")
    
    # Validate total percentage still equals 100%
    total_percentage = 0
    for adj in adjustments:
        total_percentage += adj.get('percentage', 0) / 100  # Convert from percentage to decimal
    
    print(f"Total percentage: {total_percentage * 100}%")
    
    if abs(total_percentage - 1.0) > 0.01:  # Allow small rounding errors
        conn.close()
        print(f"Error: Total percentage ({total_percentage * 100}%) must equal 100%")
        return jsonify({
            "status": "error", 
            "message": f"Total percentage ({total_percentage * 100}%) must equal 100%"
        }), 400
    
    # Update categories
    for adj in adjustments:
        cat_id = adj.get('id')
        percentage = adj.get('percentage') / 100  # Convert from percentage to decimal
        
        print(f"Updating category {cat_id} to {percentage * 100}%")
        
        c.execute(
            "UPDATE budget_categories SET percentage = ? WHERE id = ?",
            (percentage, cat_id)
        )
    
    # Get the monthly salary
    c.execute("SELECT monthly_salary FROM user_info WHERE id = 1")
    monthly_salary = c.fetchone()[0]
    
    print(f"Monthly salary: ${monthly_salary}")
    
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
            print(f"Updating allocation for category {cat_id}, month {month}: ${allocated_amount}")
            c.execute(
                "UPDATE budget_allocations SET allocated_amount = ? WHERE id = ?",
                (allocated_amount, allocation[0])
            )
        else:
            # Create new allocation
            print(f"Creating new allocation for category {cat_id}, month {month}: ${allocated_amount}")
            c.execute(
                "INSERT INTO budget_allocations (month, category_id, allocated_amount, actual_amount) VALUES (?, ?, ?, ?)",
                (month, cat_id, allocated_amount, 0)
            )
    
    conn.commit()
    conn.close()
    
    print("Budget redistribution completed successfully")
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
    
    # Handle ARS expenses by deducting from Belo account
    if currency == 'ARS':
        try:
            # Get the Belo account
            c.execute("SELECT id, balance FROM accounts WHERE name = 'Belo'")
            belo_account = c.fetchone()
            
            if belo_account:
                belo_id, belo_balance = belo_account
                
                # Get current exchange rate from cripto API
                try:
                    response = requests.get('https://dolarapi.com/v1/dolares/cripto')
                    if response.status_code == 200:
                        # Use "compra" rate (when buying ARS / selling USD)
                        rate = response.json().get("compra", 1225)
                    else:
                        rate = 1225
                except Exception as e:
                    print(f"Error getting exchange rate: {str(e)}")
                    rate = 1225
                
                # Calculate USD equivalent of the ARS expense
                usd_amount = amount / rate
                
                # Update Belo account balance
                new_belo_balance = belo_balance - usd_amount
                
                # Only update if there's enough balance
                if new_belo_balance >= 0:
                    c.execute("UPDATE accounts SET balance = ? WHERE id = ?", (new_belo_balance, belo_id))
                    
                    # Also update ARS account to reflect the expense
                    c.execute("SELECT id, balance FROM accounts WHERE currency = 'ARS'")
                    ars_account = c.fetchone()
                    
                    if ars_account:
                        ars_id, ars_balance = ars_account
                        new_ars_balance = ars_balance - amount
                        c.execute("UPDATE accounts SET balance = ? WHERE id = ?", (new_ars_balance, ars_id))
                else:
                    conn.close()
                    return jsonify({"status": "error", "message": "Insufficient balance in Belo account for this expense"}), 400
        except Exception as e:
            print(f"Error updating account balances for ARS expense: {str(e)}")
            # Continue with expense creation even if account update fails
    
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
                response = requests.get('https://dolarapi.com/v1/dolares/cripto')
                if response.status_code == 200:
                    rate = response.json().get("compra", 1225)
                    amount_in_usd = amount / rate
                else:
                    # Fallback rate
                    amount_in_usd = amount / 1225
            except:
                # Fallback rate if API fails
                amount_in_usd = amount / 1225
        
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

@app.route('/api/investments', methods=['GET'])
def get_investments():
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    c.execute("""
        SELECT id, name, purchase_date, purchase_price, quantity, 
               current_price, last_updated, notes, investment_type 
        FROM investments 
        ORDER BY purchase_date DESC
    """)
    
    investments = [
        {
            "id": row[0],
            "name": row[1],
            "purchase_date": row[2],
            "purchase_price": row[3],
            "quantity": row[4],
            "current_price": row[5],
            "last_updated": row[6],
            "notes": row[7],
            "investment_type": row[8],
            "total_value": row[4] * (row[5] if row[5] > 0 else row[3]),  # quantity * current_price (or purchase_price if no current)
            "profit_loss": row[4] * (row[5] - row[3]) if row[5] > 0 else 0  # quantity * (current - purchase)
        }
        for row in c.fetchall()
    ]
    
    # Get Investments category amount from budget
    c.execute("""
        SELECT ba.actual_amount 
        FROM budget_allocations ba
        JOIN budget_categories bc ON ba.category_id = bc.id
        WHERE bc.name = 'Investments' AND ba.month = ?
    """, (datetime.now().strftime("%Y-%m"),))
    
    budget_result = c.fetchone()
    budget_amount = budget_result[0] if budget_result else 0
    
    # Calculate total investment value
    total_invested = sum(inv["purchase_price"] * inv["quantity"] for inv in investments)
    total_current_value = sum(inv["total_value"] for inv in investments)
    total_profit_loss = sum(inv["profit_loss"] for inv in investments)
    
    conn.close()
    
    return jsonify({
        "investments": investments,
        "budget_amount": budget_amount,
        "total_invested": total_invested,
        "total_current_value": total_current_value,
        "total_profit_loss": total_profit_loss
    })

@app.route('/api/investments', methods=['POST'])
def add_investment():
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    data = request.json
    name = data.get('name', '')
    purchase_date = data.get('purchase_date', datetime.now().strftime("%Y-%m-%d"))
    purchase_price = data.get('purchase_price', 0)
    quantity = data.get('quantity', 0)
    current_price = data.get('current_price', purchase_price)
    last_updated = data.get('last_updated', datetime.now().strftime("%Y-%m-%d"))
    notes = data.get('notes', '')
    investment_type = data.get('investment_type', '')
    
    # Validate required fields
    if not name or not purchase_date or purchase_price <= 0 or quantity <= 0:
        conn.close()
        return jsonify({"status": "error", "message": "Missing or invalid required fields"}), 400
    
    # Insert the investment
    c.execute(
        """INSERT INTO investments 
           (name, purchase_date, purchase_price, quantity, current_price, last_updated, notes, investment_type) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (name, purchase_date, purchase_price, quantity, current_price, last_updated, notes, investment_type)
    )
    
    conn.commit()
    investment_id = c.lastrowid
    
    # Add a corresponding expense in the "Investments" category
    total_investment_amount = purchase_price * quantity
    description = f"Investment: {name}"
    
    # Insert the expense
    c.execute(
        """INSERT INTO expenses 
           (date, description, amount, currency, category) 
           VALUES (?, ?, ?, ?, ?)""",
        (purchase_date, description, total_investment_amount, "USD-Blue", "Investments")
    )
    
    # Get the current month for budget allocations
    current_month = "-".join(purchase_date.split("-")[:2])
    
    # Get category ID for "Investments"
    c.execute("SELECT id FROM budget_categories WHERE name = ?", ("Investments",))
    category_id_result = c.fetchone()
    
    if category_id_result:
        category_id = category_id_result[0]
        
        # Check if there's an allocation record for this month and category
        c.execute(
            "SELECT id, actual_amount FROM budget_allocations WHERE month = ? AND category_id = ?", 
            (current_month, category_id)
        )
        allocation = c.fetchone()
        
        if allocation:
            # Update existing allocation
            new_amount = allocation[1] + total_investment_amount
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
                (current_month, category_id, allocated_amount, total_investment_amount)
            )
    
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "id": investment_id})

@app.route('/api/investments/<int:investment_id>', methods=['PUT'])
def update_investment(investment_id):
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    data = request.json
    
    # Check if investment exists
    c.execute("SELECT id, name, purchase_date, purchase_price, quantity FROM investments WHERE id = ?", (investment_id,))
    old_investment = c.fetchone()
    
    if not old_investment:
        conn.close()
        return jsonify({"status": "error", "message": "Investment not found"}), 404
    
    old_id, old_name, old_date, old_price, old_quantity = old_investment
    
    # Extract data from request
    updates = []
    params = []
    
    # Handle possible update fields
    name = data.get('name', old_name)
    purchase_date = data.get('purchase_date', old_date)
    purchase_price = data.get('purchase_price', old_price)
    quantity = data.get('quantity', old_quantity)
    
    if 'name' in data:
        updates.append("name = ?")
        params.append(data['name'])
    
    if 'purchase_date' in data:
        updates.append("purchase_date = ?")
        params.append(data['purchase_date'])
    
    if 'purchase_price' in data:
        updates.append("purchase_price = ?")
        params.append(data['purchase_price'])
    
    if 'quantity' in data:
        updates.append("quantity = ?")
        params.append(data['quantity'])
    
    if 'current_price' in data:
        updates.append("current_price = ?")
        updates.append("last_updated = ?")
        params.append(data['current_price'])
        params.append(datetime.now().strftime("%Y-%m-%d"))
    
    if 'notes' in data:
        updates.append("notes = ?")
        params.append(data['notes'])
    
    if 'investment_type' in data:
        updates.append("investment_type = ?")
        params.append(data['investment_type'])
    
    # If no updates requested
    if not updates:
        conn.close()
        return jsonify({"status": "error", "message": "No fields to update"}), 400
    
    # Construct and execute update query
    query = f"UPDATE investments SET {', '.join(updates)} WHERE id = ?"
    params.append(investment_id)
    
    c.execute(query, params)
    
    # Check if we need to update the corresponding expense
    # We only need to update the expense if name, purchase date, price or quantity changed
    has_expense_changes = ('name' in data or 'purchase_date' in data or 'purchase_price' in data or 'quantity' in data)
    
    if has_expense_changes:
        # Look for the expense associated with this investment
        old_desc = f"Investment: {old_name}"
        new_desc = f"Investment: {name}"
        
        # First check if we can find the old expense
        c.execute(
            "SELECT id, amount FROM expenses WHERE description = ? AND date = ? AND category = 'Investments'",
            (old_desc, old_date)
        )
        expense = c.fetchone()
        
        if expense:
            # Update the existing expense
            expense_id, old_amount = expense
            new_amount = purchase_price * quantity
            
            c.execute(
                "UPDATE expenses SET description = ?, date = ?, amount = ? WHERE id = ?",
                (new_desc, purchase_date, new_amount, expense_id)
            )
            
            # Update budget allocation if amount changed
            if new_amount != old_amount:
                # Get current month from the purchase date
                old_month = "-".join(old_date.split("-")[:2])
                new_month = "-".join(purchase_date.split("-")[:2])
                
                # Get category ID for "Investments"
                c.execute("SELECT id FROM budget_categories WHERE name = ?", ("Investments",))
                category_id_result = c.fetchone()
                
                if category_id_result:
                    category_id = category_id_result[0]
                    
                    # Update old month allocation if different
                    if old_month != new_month:
                        # Decrease old month allocation
                        c.execute(
                            "SELECT id, actual_amount FROM budget_allocations WHERE month = ? AND category_id = ?", 
                            (old_month, category_id)
                        )
                        old_allocation = c.fetchone()
                        
                        if old_allocation:
                            old_alloc_id, old_actual = old_allocation
                            updated_old_amount = max(0, old_actual - old_amount)
                            c.execute(
                                "UPDATE budget_allocations SET actual_amount = ? WHERE id = ?",
                                (updated_old_amount, old_alloc_id)
                            )
                    
                    # Update new month allocation
                    c.execute(
                        "SELECT id, actual_amount FROM budget_allocations WHERE month = ? AND category_id = ?", 
                        (new_month, category_id)
                    )
                    new_allocation = c.fetchone()
                    
                    if new_allocation:
                        # If same month, adjust the difference
                        if old_month == new_month:
                            new_alloc_id, new_actual = new_allocation
                            diff = new_amount - old_amount
                            updated_new_amount = max(0, new_actual + diff)
                            c.execute(
                                "UPDATE budget_allocations SET actual_amount = ? WHERE id = ?",
                                (updated_new_amount, new_alloc_id)
                            )
                        else:
                            # If different month, add the full amount to new month
                            new_alloc_id, new_actual = new_allocation
                            updated_new_amount = new_actual + new_amount
                            c.execute(
                                "UPDATE budget_allocations SET actual_amount = ? WHERE id = ?",
                                (updated_new_amount, new_alloc_id)
                            )
                    else:
                        # Create new allocation for the new month
                        c.execute("SELECT monthly_salary FROM user_info WHERE id = 1")
                        monthly_salary = c.fetchone()[0]
                        
                        c.execute("SELECT percentage FROM budget_categories WHERE id = ?", (category_id,))
                        percentage = c.fetchone()[0]
                        
                        allocated_amount = monthly_salary * percentage
                        
                        c.execute(
                            "INSERT INTO budget_allocations (month, category_id, allocated_amount, actual_amount) VALUES (?, ?, ?, ?)",
                            (new_month, category_id, allocated_amount, new_amount)
                        )
        else:
            # We couldn't find the old expense, let's create a new one
            new_amount = purchase_price * quantity
            
            c.execute(
                """INSERT INTO expenses 
                   (date, description, amount, currency, category) 
                   VALUES (?, ?, ?, ?, ?)""",
                (purchase_date, new_desc, new_amount, "USD-Blue", "Investments")
            )
            
            # Update budget allocation
            new_month = "-".join(purchase_date.split("-")[:2])
            
            # Get category ID for "Investments"
            c.execute("SELECT id FROM budget_categories WHERE name = ?", ("Investments",))
            category_id_result = c.fetchone()
            
            if category_id_result:
                category_id = category_id_result[0]
                
                # Check if there's an allocation record for this month and category
                c.execute(
                    "SELECT id, actual_amount FROM budget_allocations WHERE month = ? AND category_id = ?", 
                    (new_month, category_id)
                )
                allocation = c.fetchone()
                
                if allocation:
                    # Update existing allocation
                    alloc_id, actual = allocation
                    new_actual = actual + new_amount
                    c.execute(
                        "UPDATE budget_allocations SET actual_amount = ? WHERE id = ?",
                        (new_actual, alloc_id)
                    )
                else:
                    # Create new allocation
                    c.execute("SELECT monthly_salary FROM user_info WHERE id = 1")
                    monthly_salary = c.fetchone()[0]
                    
                    c.execute("SELECT percentage FROM budget_categories WHERE id = ?", (category_id,))
                    percentage = c.fetchone()[0]
                    
                    allocated_amount = monthly_salary * percentage
                    
                    c.execute(
                        "INSERT INTO budget_allocations (month, category_id, allocated_amount, actual_amount) VALUES (?, ?, ?, ?)",
                        (new_month, category_id, allocated_amount, new_amount)
                    )
    
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})

@app.route('/api/investments/<int:investment_id>', methods=['DELETE'])
def delete_investment(investment_id):
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    # Check if investment exists and get its details
    c.execute("SELECT name, purchase_date, purchase_price, quantity FROM investments WHERE id = ?", (investment_id,))
    investment = c.fetchone()
    
    if not investment:
        conn.close()
        return jsonify({"status": "error", "message": "Investment not found"}), 404
    
    name, purchase_date, purchase_price, quantity = investment
    description = f"Investment: {name}"
    
    # Delete the investment
    c.execute("DELETE FROM investments WHERE id = ?", (investment_id,))
    
    # Find and delete the corresponding expense
    c.execute("SELECT id, amount FROM expenses WHERE description = ? AND date = ? AND category = 'Investments'", 
              (description, purchase_date))
    expense = c.fetchone()
    
    if expense:
        expense_id, amount = expense
        
        # Delete the expense
        c.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
        
        # Update budget allocation
        current_month = "-".join(purchase_date.split("-")[:2])
        
        # Get category ID for "Investments"
        c.execute("SELECT id FROM budget_categories WHERE name = ?", ("Investments",))
        category_id_result = c.fetchone()
        
        if category_id_result:
            category_id = category_id_result[0]
            
            # Adjust the budget allocation
            c.execute(
                "SELECT id, actual_amount FROM budget_allocations WHERE month = ? AND category_id = ?", 
                (current_month, category_id)
            )
            allocation = c.fetchone()
            
            if allocation:
                alloc_id, actual = allocation
                updated_amount = max(0, actual - amount)
                c.execute(
                    "UPDATE budget_allocations SET actual_amount = ? WHERE id = ?",
                    (updated_amount, alloc_id)
                )
    
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})

# Cuentas y transferencias
@app.route('/api/accounts', methods=['GET', 'POST'])
def accounts():
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()

    if request.method == 'GET':
        try:
            # Verificar si la tabla existe
            c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'")
            table_exists = c.fetchone()

            if not table_exists:
                # Crear tabla si no existe
                c.execute('''CREATE TABLE accounts
                    (id INTEGER PRIMARY KEY,
                    name TEXT,
                    currency TEXT,
                    balance REAL,
                    fee_percent REAL)''')
                
                # Insertar cuentas predeterminadas
                accounts_data = [
                    ('Payoneer', 'USD', 1500.0, 0.01),
                    ('Belo', 'USD', 0.0, 0.001),
                    ('Cuenta ARS', 'ARS', 0.0, 0.0)
                ]
                c.executemany("INSERT INTO accounts (name, currency, balance, fee_percent) VALUES (?, ?, ?, ?)", accounts_data)
                conn.commit()

            # Obtener todas las cuentas
            c.execute("SELECT id, name, currency, balance, fee_percent FROM accounts")
            accounts_data = c.fetchall()
            
            accounts = {
                account[1].lower().replace(' ', '_'): {
                    'id': account[0],
                    'name': account[1],
                    'currency': account[2],
                    'balance': account[3],
                    'fee_percent': account[4]
                }
                for account in accounts_data
            }
            
            # Actualizar el balance de la cuenta ARS basándose en Belo y tasa de Dólar Cripto
            ars_account = next((acc for acc in accounts.values() if acc['currency'] == 'ARS'), None)
            belo_account = next((acc for acc in accounts.values() if acc['name'] == 'Belo'), None)
            
            if ars_account and belo_account:
                try:
                    # Obtener la tasa actual de dolarapi.com (cripto en lugar de blue)
                    response = requests.get('https://dolarapi.com/v1/dolares/cripto')
                    if response.status_code == 200:
                        # Usar la tasa de venta (cuando el usuario compra USD)
                        rate = response.json().get("venta", 1230)
                    else:
                        rate = 1230
                        
                    # Actualizar el balance en la base de datos y en la respuesta
                    new_ars_balance = belo_account['balance'] * rate
                    
                    # Solo actualizar si hay diferencia significativa (>1%)
                    if abs(new_ars_balance - ars_account['balance']) > (ars_account['balance'] * 0.01) or ars_account['balance'] == 0:
                        c.execute("UPDATE accounts SET balance = ? WHERE id = ?", 
                                (new_ars_balance, ars_account['id']))
                        conn.commit()
                        
                        # Actualizar el balance en la respuesta
                        ars_account['balance'] = new_ars_balance
                        
                except Exception as e:
                    print(f"Error al actualizar cuenta ARS: {str(e)}")
                    # Si falla, mantener el balance actual
            
            conn.close()
            return jsonify(accounts)
            
        except Exception as e:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    elif request.method == 'POST':
        try:
            data = request.json
            
            # Actualizar cada cuenta
            for account_key, account_data in data.items():
                account_name = account_data.get('name')
                account_balance = account_data.get('balance')
                account_currency = account_data.get('currency')
                account_fee = account_data.get('fee_percent')
                account_id = account_data.get('id')
                
                if account_id:
                    # Actualizar cuenta existente
                    c.execute(
                        "UPDATE accounts SET balance = ?, currency = ?, fee_percent = ? WHERE id = ?",
                        (account_balance, account_currency, account_fee, account_id)
                    )
                else:
                    # Verificar si la cuenta ya existe por nombre
                    c.execute("SELECT id FROM accounts WHERE name = ?", (account_name,))
                    existing = c.fetchone()
                    
                    if existing:
                        # Actualizar
                        c.execute(
                            "UPDATE accounts SET balance = ?, currency = ?, fee_percent = ? WHERE id = ?",
                            (account_balance, account_currency, account_fee, existing[0])
                        )
                    else:
                        # Insertar nueva cuenta
                        c.execute(
                            "INSERT INTO accounts (name, currency, balance, fee_percent) VALUES (?, ?, ?, ?)",
                            (account_name, account_currency, account_balance, account_fee)
                        )
            
            conn.commit()
            conn.close()
            
            return jsonify({
                'status': 'success'
            })
            
        except Exception as e:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

@app.route('/api/transfers', methods=['GET', 'POST'])
def transfer_list():
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()

    if request.method == 'GET':
        try:
            # Verificar si la tabla existe
            c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='transfers'")
            table_exists = c.fetchone()

            if not table_exists:
                # Crear tabla si no existe
                c.execute('''CREATE TABLE transfers
                    (id INTEGER PRIMARY KEY,
                    date TEXT,
                    amount REAL,
                    from_account TEXT,
                    to_account TEXT,
                    gross_amount REAL,
                    total_fees REAL,
                    description TEXT)''')
                conn.commit()

            # Obtener todos los transfers
            c.execute("SELECT id, date, amount, from_account, to_account, gross_amount, total_fees, description FROM transfers ORDER BY date DESC")
            transfers_data = c.fetchall()
            
            transfers = [
                {
                    'id': transfer[0],
                    'date': transfer[1],
                    'amount': transfer[2],
                    'from_account': transfer[3],
                    'to_account': transfer[4],
                    'gross_amount': transfer[5],
                    'total_fees': transfer[6],
                    'description': transfer[7]
                }
                for transfer in transfers_data
            ]
            
            conn.close()
            return jsonify(transfers)
            
        except Exception as e:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    elif request.method == 'POST':
        try:
            data = request.json
            date = data.get('date')
            amount = data.get('amount')
            from_account = data.get('from_account')
            to_account = data.get('to_account')
            gross_amount = data.get('gross_amount')
            total_fees = data.get('total_fees')
            description = data.get('description')
            
            # Insertar nueva transferencia
            c.execute(
                "INSERT INTO transfers (date, amount, from_account, to_account, gross_amount, total_fees, description) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (date, amount, from_account, to_account, gross_amount, total_fees, description)
            )
            
            # Actualizar saldos de cuentas
            # Obtener la cuenta origen
            c.execute("SELECT balance FROM accounts WHERE name = ?", (from_account,))
            from_balance = c.fetchone()
            
            if from_balance:
                new_from_balance = from_balance[0] - gross_amount
                c.execute("UPDATE accounts SET balance = ? WHERE name = ?", (new_from_balance, from_account))
            
            # Obtener la cuenta destino
            c.execute("SELECT balance, currency FROM accounts WHERE name = ?", (to_account,))
            to_account_data = c.fetchone()
            
            if to_account_data:
                to_balance = to_account_data[0]
                to_currency = to_account_data[1]
                
                # Verificar si necesitamos convertir moneda
                if to_currency == 'ARS':
                    # Obtener tasa de cambio actual
                    try:
                        response = requests.get('https://dolarapi.com/v1/dolares/cripto')
                        if response.status_code == 200:
                            # Usar tasa de venta (cuando el usuario compra USD con ARS)
                            rate = response.json().get("venta", 1230)
                        else:
                            # Tasa alternativa si falla la API
                            rate = 1230
                    except:
                        # Tasa alternativa si falla completamente
                        rate = 1230
                    
                    # Convertir el monto a ARS
                    ars_amount = amount * rate
                    new_to_balance = to_balance + ars_amount
                else:
                    # Misma moneda, solo sumar el monto neto
                    new_to_balance = to_balance + amount
                    
                c.execute("UPDATE accounts SET balance = ? WHERE name = ?", (new_to_balance, to_account))
            
            # Nota: La creación del gasto por comisión se maneja desde el frontend
            # para evitar duplicación en los gastos de comisiones
            
            conn.commit()
            conn.close()
            
            return jsonify({
                'status': 'success'
            })
            
        except Exception as e:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

@app.route('/api/transfers/<int:transfer_id>', methods=['DELETE'])
def delete_transfer(transfer_id):
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    try:
        # Obtener detalles de la transferencia antes de eliminarla
        c.execute("SELECT amount, gross_amount, total_fees, from_account, to_account FROM transfers WHERE id = ?", (transfer_id,))
        transfer_data = c.fetchone()
        
        if not transfer_data:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Transferencia no encontrada'
            }), 404
        
        amount, gross_amount, total_fees, from_account, to_account = transfer_data
        
        # Actualizar saldos de cuentas
        # Devolver el monto bruto a la cuenta de origen
        c.execute("SELECT balance FROM accounts WHERE name = ?", (from_account,))
        from_balance = c.fetchone()
        
        if from_balance:
            new_from_balance = from_balance[0] + gross_amount
            c.execute("UPDATE accounts SET balance = ? WHERE name = ?", (new_from_balance, from_account))
        
        # Quitar el monto neto de la cuenta destino
        c.execute("SELECT balance, currency FROM accounts WHERE name = ?", (to_account,))
        to_account_data = c.fetchone()
        
        if to_account_data:
            to_balance = to_account_data[0]
            to_currency = to_account_data[1]
            
            # Verificar si fue una transferencia con conversión de moneda
            if to_currency == 'ARS' and from_account in ['Payoneer', 'Belo']:
                # Si fue convertido a ARS, intentar obtener tasa
                try:
                    response = requests.get('https://dolarapi.com/v1/dolares/cripto')
                    if response.status_code == 200:
                        # Usar tasa de venta (cuando el usuario compra USD con ARS)
                        rate = response.json().get("venta", 1230)
                    else:
                        rate = 1230
                except:
                    rate = 1230
                
                # Restar usando la tasa
                new_to_balance = to_balance - (amount * rate)
            else:
                # Sin conversión, solo restar el monto neto
                new_to_balance = to_balance - amount
                
            c.execute("UPDATE accounts SET balance = ? WHERE name = ?", (new_to_balance, to_account))
            
        # Eliminar la transferencia
        c.execute("DELETE FROM transfers WHERE id = ?", (transfer_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success'
        })
        
    except Exception as e:
        conn.close()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# Initialize the database
init_db()

# InvertirOnline API integration
@app.route('/api/broker/auth', methods=['POST'])
def broker_auth():
    data = request.json
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    username = data.get('username', '')
    password = data.get('password', '')
    
    if not username or not password:
        return jsonify({
            'success': False,
            'message': 'Username and password are required'
        }), 400
    
    try:
        # Call InvertirOnline API for authentication
        auth_url = 'https://api.invertironline.com/token'
        auth_data = {
            'username': username,
            'password': password,
            'grant_type': 'password'
        }
        
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        form_data = urlencode(auth_data)
        
        response = requests.post(auth_url, data=form_data, headers=headers)
        
        if response.status_code != 200:
            return jsonify({
                'success': False,
                'message': f'Authentication failed: {response.status_code}'
            }), response.status_code
        
        # Store tokens in database for later use
        auth_response = response.json()
        
        # Check if broker_tokens table exists
        c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='broker_tokens'")
        if c.fetchone() is None:
            c.execute('''CREATE TABLE broker_tokens (
            id INTEGER PRIMARY KEY,
            access_token TEXT,
            refresh_token TEXT,
            expires_in INTEGER,
            last_updated TEXT
            )''')
        
        # Store or update tokens
        c.execute("SELECT id FROM broker_tokens WHERE id = 1")
        if c.fetchone():
            c.execute('''UPDATE broker_tokens
            SET access_token = ?, refresh_token = ?, expires_in = ?, last_updated = ?
            WHERE id = 1''',
            (auth_response['access_token'],
            auth_response.get('refresh_token', ''),
            auth_response.get('expires_in', 3600),
            datetime.now().isoformat()))
        else:
            c.execute('''INSERT INTO broker_tokens (id, access_token, refresh_token, expires_in, last_updated)
            VALUES (1, ?, ?, ?, ?)''',
            (auth_response['access_token'],
            auth_response.get('refresh_token', ''),
            auth_response.get('expires_in', 3600),
            datetime.now().isoformat()))
        
        conn.commit()
        
        # Return the token to the frontend
        return jsonify({
            'success': True,
            'token': auth_response['access_token'],
            'message': 'Authenticated with InvertirOnline successfully'
        })
        
    except Exception as e:
        error_msg = f'Exception during authentication: {str(e)}'
        print(f"Authentication error: {error_msg}")
        return jsonify({
            'success': False,
            'message': 'Authentication failed due to an error'
        }), 500
    finally:
        conn.close()

@app.route('/api/broker/refresh', methods=['POST'])
def broker_refresh_token():
    conn = sqlite3.connect('expenses.db')
    c = conn.cursor()
    
    try:
        # Get the refresh token
        c.execute("SELECT refresh_token FROM broker_tokens WHERE id = 1")
        result = c.fetchone()
        
        if not result:
            return jsonify({
                'success': False,
                'message': 'No refresh token found. Please authenticate first.'
            }), 400
        
        refresh_token = result[0]
        
        # Call InvertirOnline API for token refresh
        auth_url = 'https://api.invertironline.com/token'
        auth_data = {
            'refresh_token': refresh_token,
            'grant_type': 'refresh_token'
        }
        
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        form_data = urlencode(auth_data)
        
        response = requests.post(auth_url, data=form_data, headers=headers)
        
        if response.status_code != 200:
            return jsonify({
                'success': False,
                'message': f'Token refresh failed: {response.status_code}'
            }), response.status_code
        
        # Update tokens in database
        auth_response = response.json()
        
        c.execute('''UPDATE broker_tokens
        SET access_token = ?, refresh_token = ?, expires_in = ?, last_updated = ?
        WHERE id = 1''',
        (auth_response['access_token'],
        auth_response['refresh_token'],
        auth_response['expires_in'],
        datetime.now().isoformat()))
        
        conn.commit()
        
        return jsonify({
            'success': True,
            'message': 'Token refreshed successfully'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': 'Token refresh failed due to an error'
        }), 500
    finally:
        conn.close()

@app.route('/api/broker/portfolio', methods=['GET'])
def broker_portfolio():
    try:
        conn = sqlite3.connect('expenses.db')
        c = conn.cursor()
        
        # Get the token from Authorization header
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            frontend_token = auth_header.split(' ')[1]
            print(f"Token received from frontend: {frontend_token[:10]}...")
            
            # Check if this matches our stored token
            c.execute("SELECT access_token FROM broker_tokens WHERE id = 1")
            result = c.fetchone()
            
            # If we have a token in DB and it doesn't match the frontend token
            if result and result[0] != frontend_token:
                print("Warning: Frontend token doesn't match stored token")
        else:
            frontend_token = None
        
        # Get the access token
        c.execute("SELECT access_token, last_updated, expires_in FROM broker_tokens WHERE id = 1")
        result = c.fetchone()
        
        if not result:
            conn.close()
            print("No access token found in database")
            return jsonify({
                'status': 'error',
                'message': 'No access token found. Please authenticate first.'
            }), 400
        
        access_token, last_updated_str, expires_in = result
        print(f"Access token found: {access_token[:10]}...")
        
        # Check if token is expired and refresh if needed
        last_updated = datetime.fromisoformat(last_updated_str)
        token_expiry = last_updated + timedelta(seconds=expires_in - 60)  # 60 second buffer
        
        if datetime.now() > token_expiry:
            # Token expired, refresh it
            print("Token has expired, refreshing...")
            conn.close()
            refresh_response = broker_refresh_token()
            refresh_data = refresh_response[0].json if hasattr(refresh_response[0], 'json') else {}
            
            if refresh_response[1] != 200:
                print(f"Refresh failed: {refresh_data.get('message', 'Unknown error')}")
                return refresh_response
            
            # Reconnect after refresh
            print("Token refreshed successfully, reconnecting...")
            conn = sqlite3.connect('expenses.db')
            c = conn.cursor()
            c.execute("SELECT access_token FROM broker_tokens WHERE id = 1")
            access_token = c.fetchone()[0]
            print(f"New access token: {access_token[:10]}...")
        
        # Call InvertirOnline API for portfolio data
        portfolio_url = 'https://api.invertironline.com/api/v2/portafolio/argentina'
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        
        print(f"Requesting portfolio data from {portfolio_url}")
        response = requests.get(portfolio_url, headers=headers)
        
        print(f"Portfolio response status: {response.status_code}")
        if response.status_code != 200:
            print(f"Portfolio response error: {response.text}")
            
            # Return a meaningful error to the frontend
            if response.status_code == 401:
                return jsonify({
                    'status': 'error',
                    'message': 'Authentication failed or token expired. Please log in again.'
                }), 401
            else:
                # Return the API response data to help with debugging
                try:
                    error_data = response.json()
                    return jsonify({
                        'status': 'error',
                        'message': f'API error: {response.status_code}',
                        'api_response': error_data
                    }), response.status_code
                except:
                    return jsonify({
                        'status': 'error',
                        'message': f'API error: {response.status_code} - {response.text}'
                    }), response.status_code
        
        # Successfully got portfolio data
        portfolio_data = response.json()
        print("Portfolio data received successfully")
        
        # If the response is already in the expected format, just return it
        if 'activos' in portfolio_data and isinstance(portfolio_data['activos'], list):
            print("Response already has 'activos' field, returning as is")
            
            # Add any user investments to the portfolio
            try:
                c.execute("""
                    SELECT id, name, purchase_date, purchase_price, quantity, current_price, investment_type
                    FROM investments
                    ORDER BY purchase_date DESC
                """)
                user_investments = c.fetchall()
                
                for inv in user_investments:
                    _, name, purchase_date, purchase_price, quantity, current_price, inv_type = inv
                    
                    # Usar precio actual o precio de compra si no hay precio actual
                    actual_price = current_price if current_price > 0 else purchase_price
                    
                    # Calcular valores
                    current_value = quantity * actual_price
                    total_invested = quantity * purchase_price
                    profit_loss = current_value - total_invested
                    profit_percent = (profit_loss / total_invested * 100) if total_invested > 0 else 0
                    
                    # Crear activo
                    user_activo = {
                        'cantidad': quantity,
                        'comprometido': 0,
                        'puntosVariacion': 0,
                        'variacionDiaria': 0,
                        'ultimoPrecio': actual_price,
                        'ppc': purchase_price,
                        'gananciaPorcentaje': round(profit_percent, 2),
                        'gananciaDinero': round(profit_loss, 2),
                        'valorizado': round(current_value, 2),
                        'titulo': {
                            'simbolo': name,
                            'descripcion': f"Mi inversión: {name}",
                            'pais': 'local',
                            'mercado': 'personal',
                            'tipo': inv_type or 'Personalizada',
                            'plazo': 'n/a',
                            'moneda': 'USD'
                        },
                        'parking': None,
                        'isUserInvestment': True  # Marcar como inversión personal
                    }
                    
                    portfolio_data['activos'].append(user_activo)
            except Exception as e:
                print(f"Error adding user investments: {str(e)}")
                
            conn.close()
            return jsonify(portfolio_data)
        
        # Convert portfolio data to expected format
        print("Converting portfolio data to expected format")
        argentina_format = {
            'pais': 'argentina',
            'activos': []
        }
        
        # Process accounts and assets
        if 'cuentas' in portfolio_data and isinstance(portfolio_data['cuentas'], list):
            for account in portfolio_data['cuentas']:
                for asset in account.get('activos', []):
                    ticker = asset.get('simbolo', '')
                    description = asset.get('descripcion', '')
                    quantity = asset.get('cantidad', 0)
                    purchase_price = asset.get('ppc', 0)
                    current_price = asset.get('ultimoPrecio', 0)
                    daily_variation = asset.get('variacionDiaria', 0)
                    
                    # Calculate derived fields
                    current_value = quantity * current_price
                    total_invested = quantity * purchase_price
                    profit_loss = current_value - total_invested
                    profit_percent = (profit_loss / total_invested * 100) if total_invested > 0 else 0
                    
                    # Determine asset type
                    asset_type = 'Letras'
                    if 'CEDEAR' in description.upper() or ticker in ['SPY', 'AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN']:
                        asset_type = 'CEDEARS'
                    elif 'BONO' in description.upper() or 'BOND' in description.upper():
                        asset_type = 'Bonos'
                    elif 'ACCIONES' in description.upper():
                        asset_type = 'Acciones'
                    
                    # Asset formatting according to argentino JSON
                    activo = {
                        'cantidad': quantity,
                        'comprometido': 0,
                        'puntosVariacion': round(daily_variation * 100, 2) if daily_variation else 0,
                        'variacionDiaria': round(daily_variation, 2) if daily_variation else 0,
                        'ultimoPrecio': current_price,
                        'ppc': purchase_price,
                        'gananciaPorcentaje': round(profit_percent, 2),
                        'gananciaDinero': round(profit_loss, 2),
                        'valorizado': round(current_value, 2),
                        'titulo': {
                            'simbolo': ticker,
                            'descripcion': description,
                            'pais': 'argentina',
                            'mercado': 'bcba',
                            'tipo': asset_type,
                            'plazo': 't1',
                            'moneda': 'peso_Argentino'
                        },
                        'parking': None
                    }
                    
                    argentina_format['activos'].append(activo)
        else:
            print(f"Unexpected portfolio data format: {portfolio_data}")
        
        # Add user investments to the portfolio
        try:
            c.execute("""
                SELECT id, name, purchase_date, purchase_price, quantity, current_price, investment_type
                FROM investments
                ORDER BY purchase_date DESC
            """)
            user_investments = c.fetchall()
            
            for inv in user_investments:
                _, name, purchase_date, purchase_price, quantity, current_price, inv_type = inv
                
                # Usar precio actual o precio de compra si no hay precio actual
                actual_price = current_price if current_price > 0 else purchase_price
                
                # Calcular valores
                current_value = quantity * actual_price
                total_invested = quantity * purchase_price
                profit_loss = current_value - total_invested
                profit_percent = (profit_loss / total_invested * 100) if total_invested > 0 else 0
                
                # Crear activo
                user_activo = {
                    'cantidad': quantity,
                    'comprometido': 0,
                    'puntosVariacion': 0,
                    'variacionDiaria': 0,
                    'ultimoPrecio': actual_price,
                    'ppc': purchase_price,
                    'gananciaPorcentaje': round(profit_percent, 2),
                    'gananciaDinero': round(profit_loss, 2),
                    'valorizado': round(current_value, 2),
                    'titulo': {
                        'simbolo': name,
                        'descripcion': f"Mi inversión: {name}",
                        'pais': 'local',
                        'mercado': 'personal',
                        'tipo': inv_type or 'Personalizada',
                        'plazo': 'n/a',
                        'moneda': 'USD'
                    },
                    'parking': None,
                    'isUserInvestment': True  # Marcar como inversión personal
                }
                
                argentina_format['activos'].append(user_activo)
        except Exception as e:
            print(f"Error adding user investments: {str(e)}")
        
        conn.close()
        print(f"Returning portfolio data with {len(argentina_format['activos'])} assets")
        return jsonify(argentina_format)
            
    except Exception as e:
        error_msg = f'Exception during portfolio fetch: {str(e)}'
        print(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500

@app.route('/api/broker/prices', methods=['GET'])
def broker_prices():
    """
    Endpoint para obtener precios actualizados en tiempo real.
    Simula una API de precios con datos actualizados para todos los activos del portafolio.
    """
    try:
        # Recuperamos los datos del portafolio primero
        portfolio_response = broker_portfolio()
        
        # Si es una respuesta de error, retornarla
        if isinstance(portfolio_response, tuple):
            return portfolio_response
        
        # Extraer los datos del portfolio
        if hasattr(portfolio_response, 'json'):
            portfolio_data = portfolio_response.json
        else:
            portfolio_data = json.loads(portfolio_response.data)
        
        # Lista para almacenar los precios actualizados
        updated_prices = []
        
        # Actualizar precios para cada activo
        for activo in portfolio_data.get('activos', []):
            symbol = activo['titulo']['simbolo']
            last_price = activo['ultimoPrecio']
            
            # Pequeña variación aleatoria (±0.5% max) para simular cambios de mercado
            volatility = 0.005
            # Distribución más cercana a normal
            random_factor = ((random.random() + random.random() + random.random() + random.random() - 2) / 2)
            percent_change = volatility * random_factor
            # Un pequeño sesgo alcista
            drift = 0.0003
            
            # Nuevo precio con variación aleatoria
            new_price = max(0.01, last_price * (1 + percent_change + drift))
            
            # Calcular la variación diaria actualizada
            if activo.get('variacionDiaria') is not None:
                base_variation = activo['variacionDiaria']
                # Ajustar la variación diaria por el cambio de precio
                new_variation = base_variation + (percent_change * 100)
            else:
                new_variation = percent_change * 100
            
            # Agregar precio actualizado
            updated_prices.append({
                'symbol': symbol,
                'last_price': round(new_price, 4),
                'previous_price': last_price,
                'variation': round(new_variation, 2),
                'timestamp': datetime.now().isoformat()
            })
        
        # Devolver los precios actualizados
        return jsonify({
            'status': 'success',
            'prices': updated_prices
        })
    
    except Exception as e:
        app.logger.error(f"Error en broker_prices: {str(e)}")
        return jsonify({
            'status': 'error', 
            'message': f'Error al obtener precios: {str(e)}'
        }), 500

if __name__ == '__main__':
    migrate_data()
    app.run(port=8092, host='0.0.0.0') 