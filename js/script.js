// --- SETUP AND STATE ---
const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
const toolbar = document.querySelector('.toolbar');
const propertyControls = document.getElementById('property-controls');
const textControls = document.getElementById('text-controls');
const strokeColorInput = document.getElementById('stroke-color');
const fillColorInput = document.getElementById('fill-color');
const fillShapeInput = document.getElementById('fill-shape');
const fontFamilyInput = document.getElementById('font-family');
const fontSizeInput = document.getElementById('font-size');

let elements = [];
let currentTool = 'rectangle';
let action = 'none';
let startX, startY;
let selectedElement = null;
let activeHandle = null;

const getGlobalStyles = () => ({
    stroke: strokeColorInput.value,
    fill: fillColorInput.value,
    isFilled: fillShapeInput.checked,
    fontFamily: fontFamilyInput.value,
    fontSize: parseInt(fontSizeInput.value, 10)
});

// --- CORE FUNCTIONS ---
const setCanvasSize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; redrawCanvas(); };
const redrawCanvas = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    elements.forEach(element => drawElement(ctx, element));
    if (selectedElement) drawSelectionBox(ctx, selectedElement);
};
const updateToolbar = () => {
    const showText = currentTool === 'text' || (selectedElement && selectedElement.type === 'text');
    const showProperties = !['select', 'eraser', 'text'].includes(currentTool) || (selectedElement && ['rectangle', 'circle'].includes(selectedElement.type));
    
    textControls.style.display = showText ? 'flex' : 'none';
    propertyControls.style.display = showProperties ? 'flex' : 'none';

    if (selectedElement) {
        strokeColorInput.value = selectedElement.stroke || '#000000';
        if (selectedElement.type === 'rectangle' || selectedElement.type === 'circle') {
            fillColorInput.value = selectedElement.fill || '#cccccc';
            fillShapeInput.checked = selectedElement.isFilled;
        }
        if (selectedElement.type === 'text') {
            strokeColorInput.value = selectedElement.fill; // Text uses fill as its color
            fontFamilyInput.value = selectedElement.fontFamily || 'Roboto';
            fontSizeInput.value = selectedElement.fontSize || 24;
        }
    } else {
         const styles = getGlobalStyles();
         strokeColorInput.value = styles.stroke;
         fillColorInput.value = styles.fill;
         fillShapeInput.checked = styles.isFilled;
         fontFamilyInput.value = styles.fontFamily;
         fontSizeInput.value = styles.fontSize;
    }
};

// --- ELEMENT CREATION & DRAWING ---
const createElement = (id, x1, y1, x2, y2, tool) => {
    const styles = getGlobalStyles();
    const base = { id, x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x1 - x2), height: Math.abs(y1 - y2), rotation: 0, stroke: styles.stroke, fill: styles.fill, isFilled: styles.isFilled };
    switch (tool) {
        case 'rectangle': return { ...base, type: 'rectangle' };
        case 'line': return { id, type: 'line', x1, y1, x2, y2, rotation: 0, stroke: styles.stroke };
        case 'circle': return { ...base, type: 'circle', cx: x1, cy: y1, radius: Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) };
        case 'freehand': return { id, type: 'freehand', points: [{ x: x1, y: y1 }], rotation: 0, stroke: styles.stroke };
        default: return null;
    }
};

const drawElement = (context, element) => {
    const bounds = getElementBounds(element);
    const centerX = bounds.x + bounds.width / 2, centerY = bounds.y + bounds.height / 2;
    context.save();
    context.translate(centerX, centerY);
    context.rotate(element.rotation || 0);
    context.translate(-centerX, -centerY);
    
    context.strokeStyle = element.stroke || '#000000';
    context.fillStyle = element.fill || '#cccccc';
    context.lineWidth = 2;
    
    context.beginPath();

    switch (element.type) {
        case 'rectangle':
            context.rect(element.x, element.y, element.width, element.height);
            if (element.isFilled) context.fill();
            context.stroke();
            break;
        case 'line':
            context.moveTo(element.x1, element.y1); context.lineTo(element.x2, element.y2); context.stroke();
            break;
        case 'circle':
            context.arc(element.cx, element.cy, element.radius, 0, 2 * Math.PI);
            if (element.isFilled) context.fill();
            context.stroke();
            break;
        case 'freehand':
            if (element.points && element.points.length > 0) {
                context.moveTo(element.points[0].x, element.points[0].y);
                for (let i = 1; i < element.points.length; i++) context.lineTo(element.points[i].x, element.points[i].y);
                context.stroke();
            }
            break;
        case 'text':
            context.font = `${element.fontSize || 24}px ${element.fontFamily || 'Roboto'}`;
            context.textAlign = 'left'; context.textBaseline = 'top';
            context.fillStyle = element.fill || '#000000'; // Text color is its fill
            
            const words = element.content.split(' '); let line = ''; let currentY = element.y;
            const lineHeight = (element.fontSize || 24) * 1.2;
            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' '; const metrics = context.measureText(testLine);
                if (metrics.width > element.width && n > 0) {
                    context.fillText(line, element.x, currentY); line = words[n] + ' '; currentY += lineHeight;
                } else line = testLine;
            }
            context.fillText(line, element.x, currentY);
            break;
    }
    context.restore();
};

// --- SELECTION, RESIZE, ROTATE ---
const getElementAtPosition = (x, y) => {
    for (let i = elements.length - 1; i >= 0; i--) if (isPointInsideElement(x, y, elements[i])) return elements[i];
    return null;
};
const isPointInsideElement = (x, y, element) => {
    const { x: elX, y: elY, width: elW, height: elH } = getElementBounds(element);
    return x >= elX && x <= elX + elW && y >= elY && y <= elY + elH;
};
const getElementBounds = (element) => {
    switch(element.type) {
        case 'rectangle': case 'text': return { x: element.x, y: element.y, width: element.width, height: element.height };
        case 'circle': return { x: element.cx - element.radius, y: element.cy - element.radius, width: element.radius * 2, height: element.radius * 2 };
        case 'line': return { x: Math.min(element.x1, element.x2), y: Math.min(element.y1, element.y2), width: Math.abs(element.x1 - element.x2), height: Math.abs(element.y1 - element.y2) };
        case 'freehand':
            if (!element.points || element.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            element.points.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
            return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        default: return { x: 0, y: 0, width: 0, height: 0 };
    }
};
const getHandles = (element) => {
    const bounds = getElementBounds(element); const handleSize = 8, halfHandle = handleSize / 2, rotationHandleOffset = 25;
    return {
        'tl': { x: bounds.x - halfHandle, y: bounds.y - halfHandle }, 'tr': { x: bounds.x + bounds.width - halfHandle, y: bounds.y - halfHandle },
        'bl': { x: bounds.x - halfHandle, y: bounds.y + bounds.height - halfHandle }, 'br': { x: bounds.x + bounds.width - halfHandle, y: bounds.y + bounds.height - halfHandle },
        'rotate': { x: bounds.x + bounds.width / 2 - halfHandle, y: bounds.y - rotationHandleOffset - halfHandle }
    };
};
const getHandleAtPosition = (x, y, element) => {
    const handles = getHandles(element);
    for (const name in handles) if (x >= handles[name].x && x <= handles[name].x + 8 && y >= handles[name].y && y <= handles[name].y + 8) return name;
    return null;
};
const drawSelectionBox = (context, element) => {
    const bounds = getElementBounds(element); const handles = getHandles(element); context.save();
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#007bff';
    context.strokeStyle = primaryColor; context.lineWidth = 1; context.setLineDash([6, 3]); context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height); context.setLineDash([]);
    context.fillStyle = '#ffffff'; for (const name in handles) { context.strokeRect(handles[name].x, handles[name].y, 8, 8); context.fillRect(handles[name].x, handles[name].y, 8, 8); }
    const rotateHandle = handles['rotate']; context.beginPath(); context.moveTo(bounds.x + bounds.width / 2, bounds.y); context.lineTo(rotateHandle.x + 4, rotateHandle.y + 4); context.stroke();
    context.restore();
};
const resizeElement = (element, handle, newX, newY, original) => {
    if (handle.includes('r')) element.width = newX - original.x;
    if (handle.includes('l')) { element.width = (original.x + original.width) - newX; element.x = newX; }
    if (handle.includes('b')) element.height = newY - original.y;
    if (handle.includes('t')) { element.height = (original.y + original.height) - newY; element.y = newY; }
    if (element.type === 'circle') { element.cx = element.x + element.width/2; element.cy = element.y + element.height/2; element.radius = Math.min(element.width, element.height) / 2; }
};
const rotateElement = (element, newX, newY) => {
    const bounds = getElementBounds(element);
    const centerX = bounds.x + bounds.width / 2, centerY = bounds.y + bounds.height / 2;
    element.rotation = Math.atan2(newY - centerY, newX - centerX) + Math.PI / 2;
};

// --- IN-CANVAS TEXT EDITING ---
const createTextArea = (x, y, width, height, element = null) => {
    const textArea = document.createElement('textarea'); textArea.id = 'text-input-area';
    const styles = element ? element : getGlobalStyles();
    textArea.value = element ? element.content : '';
    textArea.style.left = `${x}px`; textArea.style.top = `${y}px`; textArea.style.width = `${width}px`; textArea.style.height = `${height}px`;
    textArea.style.fontSize = `${styles.fontSize}px`; textArea.style.fontFamily = styles.fontFamily;
    textArea.style.color = element ? element.fill : getGlobalStyles().stroke;
    if (element) textArea.dataset.elementId = element.id;
    document.body.appendChild(textArea); textArea.focus();
    textArea.addEventListener('blur', () => commitText(textArea), { once: true });
};
const commitText = (textArea) => {
    const content = textArea.value; const elementId = textArea.dataset.elementId;
    if (elementId) {
        const element = elements.find(el => el.id === elementId);
        if (element) {
            if (content.trim() === '') elements = elements.filter(el => el.id !== elementId);
            else { element.content = content; element.width = parseFloat(textArea.style.width); element.height = parseFloat(textArea.style.height); }
        }
    } else if (content.trim()) {
        const styles = getGlobalStyles();
        elements.push({ 
            id: Date.now().toString(), type: 'text', content, 
            x: parseInt(textArea.style.left, 10), y: parseInt(textArea.style.top, 10),
            width: parseInt(textArea.style.width, 10), height: parseInt(textArea.style.height, 10),
            rotation: 0, fill: styles.stroke, // Text color is based on stroke
            fontFamily: styles.fontFamily, fontSize: styles.fontSize 
        });
    }
    document.body.removeChild(textArea); selectedElement = null; redrawCanvas(); updateToolbar();
};

// --- MOUSE EVENT HANDLERS ---
const getMousePos = (evt) => ({ x: evt.clientX, y: evt.clientY });
let originalElementState;

canvas.addEventListener('mousedown', (e) => {
    const { x, y } = getMousePos(e); startX = x; startY = y;
    if (currentTool === 'text') { action = 'drawingTextBox'; return; }
    if (currentTool === 'select') {
        activeHandle = selectedElement ? getHandleAtPosition(x, y, selectedElement) : null;
        if (activeHandle) { action = activeHandle === 'rotate' ? 'rotating' : 'resizing'; originalElementState = { ...getElementBounds(selectedElement) }; } 
        else { selectedElement = getElementAtPosition(x, y); action = selectedElement ? 'dragging' : 'none'; }
    } else if (currentTool === 'eraser') { action = 'erasing';
    } else { // Drawing tools
        action = 'drawing';
        selectedElement = null;
        const newElement = createElement(Date.now().toString(), x, y, x, y, currentTool);
        elements.push(newElement);
    }
    redrawCanvas(); updateToolbar();
});

canvas.addEventListener('mousemove', (e) => {
    if (action === 'none') return;
    const { x, y } = getMousePos(e);
    
    if (action === 'drawing') {
        const lastElement = elements[elements.length - 1];
        if (currentTool === 'freehand') {
            lastElement.points.push({ x, y });
        } else {
             // Create a temporary object to avoid mutating the original until mouseup
            const updatedElement = createElement(lastElement.id, startX, startY, x, y, currentTool);
            Object.assign(lastElement, updatedElement);
        }
    } else if (action === 'drawingTextBox') {
        redrawCanvas();
        ctx.save(); ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#007bff'; ctx.lineWidth = 1; ctx.setLineDash([6, 3]); ctx.strokeRect(startX, startY, x - startX, y - startY); ctx.restore();
    } else if (action === 'dragging' && selectedElement) {
        const dx = x - startX, dy = y - startY;
        const updatePos = (el) => {
            el.x = (el.x || 0) + dx; el.y = (el.y || 0) + dy;
            if (el.type === 'circle') { el.cx += dx; el.cy += dy; }
            if (el.type === 'line') { el.x1 += dx; el.y1 += dy; el.x2 += dx; el.y2 += dy; }
            if (el.type === 'freehand') { el.points.forEach(p => { p.x += dx; p.y += dy; }); }
        };
        updatePos(selectedElement);
        startX = x; startY = y;
    } else if (action === 'resizing' && selectedElement) { resizeElement(selectedElement, activeHandle, x, y, originalElementState);
    } else if (action === 'rotating' && selectedElement) { rotateElement(selectedElement, x, y);
    } else if (action === 'erasing') { const el = getElementAtPosition(x, y); if (el) { elements = elements.filter(e => e.id !== el.id); } }
    
    if (action !== 'drawingTextBox') redrawCanvas();
});

canvas.addEventListener('mouseup', (e) => {
    if (action === 'drawingTextBox') {
        const { x, y } = getMousePos(e);
        const textX = Math.min(x, startX), textY = Math.min(y, startY), textWidth = Math.abs(x - startX), textHeight = Math.abs(y - startY);
        if (textWidth > 10 && textHeight > 10) createTextArea(textX, textY, textWidth, textHeight);
    }
    action = 'none'; activeHandle = null; originalElementState = null;
    redrawCanvas();
});
        
canvas.addEventListener('dblclick', (e) => {
    if (currentTool !== 'select') return;
    const { x, y } = getMousePos(e); const el = getElementAtPosition(x, y);
    if (el && el.type === 'text') { selectedElement = null; redrawCanvas(); createTextArea(el.x, el.y, el.width, el.height, el); }
});

// --- TOOLBAR AND FILE I/O ---
toolbar.addEventListener('click', (e) => {
    const target = e.target.closest('button, label'); if (!target) return;
    if (target.id === 'clear-canvas') { elements = []; selectedElement = null; redrawCanvas(); } 
    else if (target.id === 'save-drawing') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(elements)],{type:'application/json'})); a.download='drawing.json'; a.click(); } 
    else if (target.dataset.tool) {
        currentTool = target.dataset.tool;
        toolbar.querySelectorAll('[data-tool]').forEach(btn => btn.classList.remove('active'));
        target.classList.add('active');
        canvas.style.cursor = currentTool === 'eraser' ? 'cell' : (currentTool === 'select' ? 'default' : 'crosshair');
        selectedElement = null; redrawCanvas();
    }
    updateToolbar();
});

document.getElementById('load-drawing').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { elements = JSON.parse(event.target.result); selectedElement = null; redrawCanvas(); updateToolbar(); };
    reader.readAsText(file); e.target.value = null;
});

[strokeColorInput, fillColorInput, fillShapeInput, fontFamilyInput, fontSizeInput].forEach(input => {
    input.addEventListener('input', () => {
        if(selectedElement) {
            const styles = getGlobalStyles();
            if (selectedElement.type === 'text') {
                selectedElement.fill = styles.stroke; // text color from stroke picker
                selectedElement.fontFamily = styles.fontFamily;
                selectedElement.fontSize = styles.fontSize;
            } else {
                selectedElement.stroke = styles.stroke;
                if(selectedElement.type === 'rectangle' || selectedElement.type === 'circle') {
                    selectedElement.fill = styles.fill;
                    selectedElement.isFilled = styles.isFilled;
                }
            }
            redrawCanvas();
        }
    });
});

// --- INITIALIZATION ---
setCanvasSize(); window.addEventListener('resize', setCanvasSize);
document.querySelector('[data-tool="rectangle"]').classList.add('active');
canvas.style.cursor = 'crosshair';
updateToolbar();