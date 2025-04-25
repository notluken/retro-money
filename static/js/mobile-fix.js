/**
 * Mobile-specific fixes for Retro Money app
 * This script enhances the mobile experience and fixes menu visibility issues
 */

document.addEventListener('DOMContentLoaded', function() {
    // More aggressive fix: force menu visibility with a timeout
    function forceMenuVisibility() {
        // Ensure the excel header and menubar are visible
        const excelHeader = document.querySelector('.excel-header');
        const excelMenubar = document.querySelector('.excel-menubar');
        
        if (excelHeader) {
            excelHeader.style.display = 'flex';
            excelHeader.style.height = 'auto';
            excelHeader.style.flexDirection = 'column';
            excelHeader.style.paddingBottom = '8px';
            // Force visibility
            excelHeader.style.visibility = 'visible';
            excelHeader.style.opacity = '1';
            excelHeader.style.zIndex = '100';
            excelHeader.style.width = '100%';
        }
        
        if (excelMenubar) {
            excelMenubar.style.display = 'flex';
            excelMenubar.style.width = '100%';
            excelMenubar.style.justifyContent = 'center';
            excelMenubar.style.flexWrap = 'wrap';
            // Force visibility
            excelMenubar.style.visibility = 'visible';
            excelMenubar.style.opacity = '1';
            excelMenubar.style.position = 'relative';
            excelMenubar.style.zIndex = '50';
            
            // Get all menu items and style them
            const menuItems = excelMenubar.querySelectorAll('.menu-item');
            menuItems.forEach(item => {
                item.style.padding = '8px 12px';
                item.style.margin = '3px 5px';
                item.style.fontSize = '16px';
                item.style.fontWeight = 'bold';
                item.style.backgroundColor = '#c0c0c0';
                item.style.color = '#000000';
                item.style.border = '2px solid #808080';
                item.style.borderRadius = '4px';
                item.style.boxShadow = '2px 2px 0 #fff inset, -2px -2px 0 #707070 inset';
                item.style.textDecoration = 'none';
                item.style.display = 'block';
                
                // Add active styles if this is the active page
                if (item.classList.contains('active')) {
                    item.style.backgroundColor = '#0000aa';
                    item.style.color = 'white';
                    item.style.boxShadow = '2px 2px 0 #404040 inset, -2px -2px 0 #8080ff inset';
                }
            });
        }
    }
    
    // Force the page to use 100% width and height
    function forceFullSize() {
        // Force html and body to 100% width and height with no borders or margins
        document.documentElement.style.width = '100%';
        document.documentElement.style.height = '100%';
        document.documentElement.style.margin = '0';
        document.documentElement.style.padding = '0';
        document.documentElement.style.overflow = 'hidden';
        document.documentElement.style.position = 'fixed';
        document.documentElement.style.top = '0';
        document.documentElement.style.left = '0';
        document.documentElement.style.right = '0';
        document.documentElement.style.bottom = '0';
        
        document.body.style.width = '100%';
        document.body.style.height = '100%';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.overflow = 'hidden';
        document.body.style.minWidth = '100%';
        document.body.style.position = 'fixed';
        document.body.style.top = '0';
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.bottom = '0';
        
        // Make sure the excel container takes up full space
        const excelContainer = document.querySelector('.excel-container');
        if (excelContainer) {
            excelContainer.style.width = '100%';
            excelContainer.style.height = '100%';
            excelContainer.style.minHeight = '100vh';
            excelContainer.style.maxHeight = '100vh';
            excelContainer.style.margin = '0';
            excelContainer.style.padding = '0';
            excelContainer.style.boxSizing = 'border-box';
            excelContainer.style.display = 'flex';
            excelContainer.style.flexDirection = 'column';
            excelContainer.style.borderRadius = '0';
            excelContainer.style.border = '0';
            excelContainer.style.boxShadow = 'none';
            excelContainer.style.position = 'absolute';
            excelContainer.style.top = '0';
            excelContainer.style.left = '0';
            excelContainer.style.right = '0';
            excelContainer.style.bottom = '0';
            excelContainer.style.overflow = 'hidden';
        }
        
        // Make the spreadsheet area take all available space
        const spreadsheetArea = document.querySelector('.spreadsheet-area');
        if (spreadsheetArea) {
            spreadsheetArea.style.flex = '1';
            spreadsheetArea.style.overflowY = 'auto';
            spreadsheetArea.style.overflowX = 'hidden';
            spreadsheetArea.style.width = '100%';
            spreadsheetArea.style.boxSizing = 'border-box';
            spreadsheetArea.style.padding = '10px';
            spreadsheetArea.style.position = 'relative';
        }
        
        // Ensure status bar is at the bottom
        const statusBar = document.querySelector('.excel-statusbar');
        if (statusBar) {
            statusBar.style.width = '100%';
            statusBar.style.position = 'relative';
            statusBar.style.bottom = '0';
            statusBar.style.left = '0';
            statusBar.style.right = '0';
        }
        
        // Add retro styling to form elements
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            button.style.backgroundColor = '#c0c0c0';
            button.style.border = '2px outset #dedede';
            button.style.borderRadius = '0';
            button.style.boxShadow = '2px 2px 0 #fff inset, -2px -2px 0 #707070 inset';
            button.style.padding = '5px 10px';
            button.style.fontWeight = 'bold';
            button.style.cursor = 'pointer';
        });
        
        const inputs = document.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.style.border = '2px inset #808080';
            input.style.borderRadius = '0';
            input.style.backgroundColor = '#ffffff';
            input.style.padding = '5px';
        });
        
        // Add retro styling to tables
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%';
            table.style.border = '2px solid #404040';
        });
        
        const ths = document.querySelectorAll('th');
        ths.forEach(th => {
            th.style.backgroundColor = '#c0c0c0';
            th.style.border = '1px solid #808080';
            th.style.padding = '8px';
            th.style.fontWeight = 'bold';
        });
        
        const tds = document.querySelectorAll('td');
        tds.forEach(td => {
            td.style.border = '1px solid #c6c6c6';
            td.style.padding = '8px';
            td.style.backgroundColor = '#ffffff';
        });
        
        // Add retro styling to sections
        const sections = document.querySelectorAll('.todo-header, .todo-form, .todo-list, .todo-stats, .account-management-section, .transfer-management-section, .transfers-history-section');
        sections.forEach(section => {
            section.style.backgroundColor = '#ffffff';
            section.style.border = '2px solid #808080';
            section.style.padding = '10px';
            section.style.marginBottom = '15px';
            section.style.boxShadow = '3px 3px 5px rgba(0, 0, 0, 0.2)';
            section.style.width = '100%';
            section.style.boxSizing = 'border-box';
        });
        
        // Style section titles
        const titles = document.querySelectorAll('.section-title, .form-title');
        titles.forEach(title => {
            title.style.backgroundColor = '#2e3f5a';
            title.style.color = '#ffffff';
            title.style.padding = '5px 10px';
            title.style.marginBottom = '10px';
            title.style.fontWeight = 'bold';
            title.style.textShadow = '1px 1px 0 rgba(0, 0, 0, 0.5)';
        });
        
        // Fix any modal dialogs to ensure they take the full width
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.right = '0';
            modal.style.bottom = '0';
            modal.style.padding = '0';
            modal.style.margin = '0';
            modal.style.border = '0';
            modal.style.borderRadius = '0';
            modal.style.boxSizing = 'border-box';
        });
    }
    
    // Call immediately
    forceMenuVisibility();
    forceFullSize();
    
    // Then call again after a short delay to make sure it applies
    setTimeout(forceMenuVisibility, 100);
    setTimeout(forceFullSize, 100);
    
    // And again after page is fully loaded
    setTimeout(forceMenuVisibility, 500);
    setTimeout(forceFullSize, 500);
    
    // And again after a longer delay to handle any dynamic content
    setTimeout(forceMenuVisibility, 1000);
    setTimeout(forceFullSize, 1000);
    
    // Fix scrolling issues on iOS
    const gridWithRowHeaders = document.querySelector('.grid-with-row-headers');
    if (gridWithRowHeaders) {
        gridWithRowHeaders.style.webkitOverflowScrolling = 'touch';
        gridWithRowHeaders.style.overflowY = 'scroll';
        gridWithRowHeaders.style.overscrollBehavior = 'auto';
    }
    
    // Fix container widths
    const excelContainer = document.querySelector('.excel-container');
    const gridContainer = document.querySelector('.grid-container');
    
    if (excelContainer) {
        excelContainer.style.width = '100%';
        excelContainer.style.minWidth = '0';
        excelContainer.style.margin = '0';
        excelContainer.style.border = '0';
        excelContainer.style.borderRadius = '0';
    }
    
    if (gridContainer) {
        gridContainer.style.width = '100%';
        gridContainer.style.overflowX = 'auto';
    }
    
    // Apply styles to the body to avoid scrolling issues
    document.body.style.overflowX = 'hidden';
    document.body.style.width = '100%';
    document.body.style.minWidth = '0';
    
    // Handle viewport changes and orientation
    function updateViewport() {
        // iPhone viewport fix
        const viewportMetaTag = document.querySelector('meta[name="viewport"]');
        if (viewportMetaTag) {
            viewportMetaTag.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
        }
        
        // Reset height to fix iOS issue
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        
        // Force spreadsheet area to take remaining height
        const excelHeader = document.querySelector('.excel-header');
        const excelStatusbar = document.querySelector('.excel-statusbar');
        const spreadsheetArea = document.querySelector('.spreadsheet-area');
        
        if (excelHeader && excelStatusbar && spreadsheetArea) {
            const headerHeight = excelHeader.offsetHeight;
            const statusbarHeight = excelStatusbar.offsetHeight;
            const remainingHeight = window.innerHeight - headerHeight - statusbarHeight;
            spreadsheetArea.style.height = `${remainingHeight}px`;
        }
    }
    
    // Initial update
    updateViewport();
    
    // Also update on scroll events
    document.addEventListener('scroll', function() {
        forceMenuVisibility();
    });
    
    // Fix for landscape mode on small screens
    function handleOrientation() {
        forceMenuVisibility();
        forceFullSize();
        updateViewport();
        
        if (window.innerWidth <= 896 && window.innerHeight <= 450) {
            if (excelHeader) {
                excelHeader.style.paddingBottom = '5px';
            }
            
            if (excelMenubar) {
                const menuItems = excelMenubar.querySelectorAll('.menu-item');
                menuItems.forEach(item => {
                    item.style.padding = '6px 10px';
                    item.style.fontSize = '14px';
                });
            }
        }
    }
    
    // Call on load and on orientation change
    handleOrientation();
    window.addEventListener('orientationchange', handleOrientation);
    window.addEventListener('resize', handleOrientation);

    // Log that mobile fixes have been applied
    console.log('Mobile fixes applied - Full screen borders removed');
}); 