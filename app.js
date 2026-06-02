// Multi-Heap Visualizer Logic for UFPS - Análisis de Algoritmos
// Supports: Binomial, Fibonacci, Leftist, Skew, and Pairing Heaps

let nodeCounter = 0;

// --- Unified Heap Node Class ---
class HeapNode {
    constructor(val) {
        this.id = 'node_' + (++nodeCounter);
        this.val = parseInt(val, 10);
        
        // Multiway fields (Binomial, Fibonacci, Pairing)
        this.children = [];
        this.order = 0; // degree for binomial/fibonacci
        
        // Fibonacci specific
        this.marked = false;
        
        // Binary fields (Leftist, Skew)
        this.left = null;
        this.right = null;
        
        // Leftist specific (Null Path Length)
        this.dist = 0;
    }

    clone() {
        let copy = new HeapNode(this.val);
        copy.id = this.id; // Keep same ID to track identity
        copy.order = this.order;
        copy.marked = this.marked;
        copy.dist = this.dist;
        
        if (this.left) copy.left = this.left.clone();
        if (this.right) copy.right = this.right.clone();
        
        copy.children = this.children.map(c => c.clone());
        return copy;
    }
}

// Helper to safely clone node or return null
function cloneOrNull(node) {
    return node ? node.clone() : null;
}

// --- Universal Subtree-Width Layout & Rendering Engine ---

// Get children based on active structure type
function getChildren(node) {
    if (!node) return [];
    // If it has leftist/skew style child properties, prioritize binary
    if (node.left !== null || node.right !== null) {
        let res = [];
        if (node.left) res.push(node.left);
        if (node.right) res.push(node.right);
        return res;
    }
    return node.children || [];
}

// Recursively calculates subtree width in relative units
function calculateSubtreeWidths(node, widthsMap) {
    if (!node) return 0;
    let children = getChildren(node);
    if (children.length === 0) {
        widthsMap[node.id] = 1;
        return 1;
    }
    let totalWidth = 0;
    for (let child of children) {
        totalWidth += calculateSubtreeWidths(child, widthsMap);
    }
    widthsMap[node.id] = totalWidth;
    return totalWidth;
}

// Recursively assigns relative coordinates
function assignCoords(node, rxCenter, ry, widthsMap, positionsMap) {
    if (!node) return;
    positionsMap[node.id] = { rx: rxCenter, ry: ry };
    
    let children = getChildren(node);
    if (children.length === 0) return;
    
    let totalWidth = widthsMap[node.id];
    let startRx = rxCenter - totalWidth / 2;
    let currentRx = startRx;
    
    for (let child of children) {
        let childWidth = widthsMap[child.id];
        let childRxCenter = currentRx + childWidth / 2;
        assignCoords(child, childRxCenter, ry + 1, widthsMap, positionsMap);
        currentRx += childWidth;
    }
}

// Compute screen coordinates for trees in the forest
function computeLayout(trees, width, height, customDy = 65, customPaddingY = 50) {
    let positions = {};
    let nodeMap = {};
    
    let treeRelativePositions = [];
    let rxMax = 0;
    let ryMax = 0;
    
    // 1. Compute relative positions for each tree
    for (let i = 0; i < trees.length; i++) {
        let tree = trees[i];
        if (!tree) continue;
        
        let widthsMap = {};
        calculateSubtreeWidths(tree, widthsMap);
        
        let relPos = {};
        assignCoords(tree, 0, 0, widthsMap, relPos);
        
        let tMinRx = Infinity;
        let tMaxRx = -Infinity;
        let tMaxRy = 0;
        for (let id in relPos) {
            tMinRx = Math.min(tMinRx, relPos[id].rx);
            tMaxRx = Math.max(tMaxRx, relPos[id].rx);
            tMaxRy = Math.max(tMaxRy, relPos[id].ry);
        }
        
        treeRelativePositions.push({
            tree: tree,
            positions: relPos,
            minRx: tMinRx === Infinity ? 0 : tMinRx,
            maxRx: tMaxRx === -Infinity ? 0 : tMaxRx,
            height: tMaxRy
        });
        
        ryMax = Math.max(ryMax, tMaxRy);
    }
    
    // 2. Align trees side-by-side without overlaps
    let currentOffset = 0;
    let absoluteRelativePos = {};
    
    for (let i = 0; i < treeRelativePositions.length; i++) {
        let tData = treeRelativePositions[i];
        // Shift minRx to align at currentOffset
        let shift = currentOffset - tData.minRx;
        
        for (let id in tData.positions) {
            let rel = tData.positions[id];
            absoluteRelativePos[id] = {
                rx: rel.rx + shift,
                ry: rel.ry
            };
            rxMax = Math.max(rxMax, rel.rx + shift);
        }
        
        currentOffset += (tData.maxRx - tData.minRx) + 1.5; // gap of 1.5 units between trees
    }
    
    // 3. Map IDs to node objects
    function mapNodes(node) {
        if (!node) return;
        nodeMap[node.id] = node;
        let children = getChildren(node);
        for (let child of children) {
            mapNodes(child);
        }
    }
    for (let t of trees) {
        mapNodes(t);
    }
    
    // 4. Convert relative to screen coordinates
    let paddingX = 40;
    let paddingY = customPaddingY;
    let dx = 45; // default scale
    let dy = customDy;
    
    if (rxMax > 0) {
        let availableWidth = width - 2 * paddingX;
        dx = Math.min(60, availableWidth / rxMax);
    }
    
    // Center layout horizontally
    let usedWidth = rxMax * dx;
    let xOffset = (width - usedWidth) / 2;
    if (rxMax === 0) xOffset = width / 2;
    
    let screenPositions = {};
    for (let id in absoluteRelativePos) {
        let rel = absoluteRelativePos[id];
        screenPositions[id] = {
            x: xOffset + rel.rx * dx,
            y: paddingY + rel.ry * dy
        };
    }
    
    return {
        positions: screenPositions,
        nodeMap: nodeMap
    };
}

// Draw a forest on a given SVG element
function drawHeapInSvg(svg, trees, highlights = [], compareIds = [], customHeight = null) {
    svg.innerHTML = '';
    if (trees.length === 0) return;
    
    // defs for glow filter
    let defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
        <filter id="glow-primary" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
    `;
    svg.appendChild(defs);
    
    let width = svg.clientWidth || svg.parentNode.clientWidth || 800;
    let height = customHeight || svg.clientHeight || 450;
    
    let customDy = customHeight ? 22 : 65;
    let customPaddingY = customHeight ? 20 : 50;
    
    let layout = computeLayout(trees, width, height, customDy, customPaddingY);
    let positions = layout.positions;
    let nodeMap = layout.nodeMap;
    
    // Find minimum value to highlight
    let globalMinVal = Infinity;
    let globalMinId = null;
    for (let id in nodeMap) {
        if (nodeMap[id].val < globalMinVal) {
            globalMinVal = nodeMap[id].val;
            globalMinId = id;
        }
    }
    
    // 1. Draw Edges
    for (let id in positions) {
        let node = nodeMap[id];
        let pos = positions[id];
        let children = getChildren(node);
        
        for (let child of children) {
            let childPos = positions[child.id];
            if (childPos) {
                let edge = document.createElementNS("http://www.w3.org/2000/svg", "line");
                edge.setAttribute("x1", pos.x);
                edge.setAttribute("y1", pos.y);
                edge.setAttribute("x2", childPos.x);
                edge.setAttribute("y2", childPos.y);
                
                let isHighlight = (highlights.includes(node.id) && highlights.includes(child.id)) ||
                                  (compareIds.includes(node.id) && compareIds.includes(child.id));
                                  
                edge.setAttribute("class", isHighlight ? "svg-edge highlight" : "svg-edge");
                svg.appendChild(edge);
            }
        }
    }
    
    // 2. Draw Nodes
    let rootIds = new Set(trees.map(t => t.id));
    let nodeRadius = customHeight ? 12 : 20;
    
    for (let id in positions) {
        let node = nodeMap[id];
        let pos = positions[id];
        
        let g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "svg-node-group");
        g.setAttribute("transform", `translate(${pos.x}, ${pos.y})`);
        
        let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("r", nodeRadius);
        
        let nodeClass = "svg-node";
        if (compareIds.includes(node.id)) {
            nodeClass += " compare";
        } else if (highlights.includes(node.id)) {
            nodeClass += " new";
        } else if (id === globalMinId && !customHeight) {
            nodeClass += " minimum";
        }
        circle.setAttribute("class", nodeClass);
        
        // Custom marks or labels
        if (node.marked) {
            // Fibonacci marked styling
            circle.style.fill = "rgba(245, 158, 11, 0.25)";
            circle.style.stroke = "var(--color-warning)";
        }
        
        g.appendChild(circle);
        
        // Value label
        let text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("class", "svg-node-text");
        text.setAttribute("y", "1");
        if (customHeight) {
            text.style.fontSize = "0.55rem";
        }
        text.textContent = node.val;
        g.appendChild(text);
        
        // Leftist heap NPL display
        if (selectedHeapType === 'leftist' && node.dist !== undefined && !customHeight) {
            let distText = document.createElementNS("http://www.w3.org/2000/svg", "text");
            distText.setAttribute("class", "svg-node-index");
            distText.setAttribute("x", nodeRadius + 14);
            distText.setAttribute("y", "4");
            distText.style.fill = "var(--color-secondary)";
            distText.style.fontWeight = "bold";
            distText.textContent = `d=${node.dist}`;
            g.appendChild(distText);
        }
        
        // Binomial Tree Order label
        if (selectedHeapType === 'binomial' && rootIds.has(node.id) && !customHeight) {
            let badgeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
            badgeText.setAttribute("class", "svg-node-index");
            badgeText.setAttribute("y", -nodeRadius - 8);
            badgeText.textContent = `B${node.order}`;
            g.appendChild(badgeText);
        }
        
        svg.appendChild(g);
    }
}

// --- HEAP TYPE 1: BINOMIAL HEAP ---

function binomialUnion(A, B, steps, title) {
    let maxOrder = Math.max(A.length, B.length);
    let carry = null;
    let result = [];
    
    for (let i = 0; i <= maxOrder || carry; i++) {
        let t1 = (i < A.length) ? A[i] : null;
        let t2 = (i < B.length) ? B[i] : null;
        
        let active = [];
        if (t1) active.push({ tree: t1, source: 'A' });
        if (t2) active.push({ tree: t2, source: 'B' });
        if (carry) active.push({ tree: carry, source: 'acarreo' });
        
        if (active.length === 0) continue;
        
        let descActive = active.map(item => {
            if (item.source === 'A') return `raíz ${item.tree.val} (de A)`;
            if (item.source === 'B') return `raíz ${item.tree.val} (de B)`;
            return `raíz ${item.tree.val} (acarreo)`;
        }).join(', ');
        
        steps.push({
            trees: combineTreesForDisplay(result, A.slice(i), B.slice(i), carry, i),
            desc: `<strong>Orden ${i}:</strong> Evaluamos árboles activos: ${descActive}.`,
            highlights: active.map(item => item.tree.id)
        });
        
        if (active.length === 1) {
            let soleTree = active[0].tree;
            result[i] = soleTree;
            carry = null;
            steps.push({
                trees: combineTreesForDisplay(result, A.slice(i+1), B.slice(i+1), carry, -1),
                desc: `Como solo hay un árbol de orden ${i} (${soleTree.val}), se añade al resultado.`,
                highlights: [soleTree.id]
            });
        }
        else if (active.length === 2) {
            let node1 = active[0].tree;
            let node2 = active[1].tree;
            
            steps.push({
                trees: combineTreesForDisplay(result, A.slice(i), B.slice(i), carry, i),
                desc: `Comparamos las raíces de orden ${i}: <strong>${node1.val}</strong> y <strong>${node2.val}</strong>. El menor será la raíz del nuevo árbol de orden ${i+1}.`,
                highlights: [node1.id, node2.id],
                compare: [node1.id, node2.id]
            });
            
            let parent, child;
            if (node1.val <= node2.val) {
                parent = node1; child = node2;
            } else {
                parent = node2; child = node1;
            }
            
            parent.children.push(child);
            parent.order++;
            carry = parent;
            
            steps.push({
                trees: combineTreesForDisplay(result, A.slice(i+1), B.slice(i+1), carry, -1),
                desc: `Fusionados: <strong>${child.val}</strong> ahora es hijo de <strong>${parent.val}</strong>. Queda como acarreo de orden ${parent.order}.`,
                highlights: [parent.id]
            });
        }
        else if (active.length === 3) {
            let node1 = active[0].tree;
            let node2 = active[1].tree;
            let cNode = active[2].tree;
            
            result[i] = cNode;
            
            steps.push({
                trees: combineTreesForDisplay(result, A.slice(i), B.slice(i), carry, i),
                desc: `Tenemos tres árboles de orden ${i}. Agregamos el acarreo (<strong>${cNode.val}</strong>) al resultado. Las raíces de A (${node1.val}) y B (${node2.val}) se fusionarán.`,
                highlights: [node1.id, node2.id, cNode.id],
                compare: [node1.id, node2.id]
            });
            
            let parent, child;
            if (node1.val <= node2.val) {
                parent = node1; child = node2;
            } else {
                parent = node2; child = node1;
            }
            
            parent.children.push(child);
            parent.order++;
            carry = parent;
            
            steps.push({
                trees: combineTreesForDisplay(result, A.slice(i+1), B.slice(i+1), carry, -1),
                desc: `Fusionados: <strong>${child.val}</strong> es ahora hijo de <strong>${parent.val}</strong>. Se genera un acarreo de orden ${parent.order}.`,
                highlights: [parent.id]
            });
        }
    }
    
    return result.filter(t => t !== null);
}

function generateBinomialInsertSteps(trees, val) {
    let steps = [];
    let tempNode = new HeapNode(val);
    let A = trees.map(t => t ? t.clone() : null);
    let B = [tempNode];
    
    steps.push({
        trees: combineTreesForDisplay([], A, B, null, -1),
        desc: `<strong>Insertar ${val}:</strong> Creamos un árbol de orden 0 con el nuevo nodo y lo fusionamos con el heap.`,
        highlights: [tempNode.id]
    });
    
    let finalTrees = binomialUnion(A, B, steps, `Insertar ${val}`);
    steps.push({
        trees: finalTrees.map(t => t.clone()),
        desc: `Inserción de <strong>${val}</strong> finalizada.`,
        highlights: []
    });
    return { finalTrees, steps };
}

function generateBinomialExtractMinSteps(trees) {
    let steps = [];
    if (trees.every(t => t === null)) {
        return { finalTrees: [], steps: [] };
    }
    
    let activeTrees = trees.filter(t => t !== null);
    let minNode = null;
    for (let t of activeTrees) {
        if (!minNode || t.val < minNode.val) minNode = t;
    }
    
    steps.push({
        trees: activeTrees.map(t => t.clone()),
        desc: `Buscamos la raíz mínima. Es el nodo <strong>${minNode.val}</strong> (en el árbol de grado B${minNode.order}).`,
        highlights: [minNode.id]
    });
    
    let remainingTrees = trees.map(t => t ? t.clone() : null);
    let minOrder = minNode.order;
    remainingTrees[minOrder] = null;
    
    let children = minNode.children.map(t => t.clone());
    
    let displayTrees = remainingTrees.filter(t => t !== null).concat(children);
    steps.push({
        trees: displayTrees.map(t => t.clone()),
        desc: `Eliminamos la raíz <strong>${minNode.val}</strong>. Sus hijos se extraen y forman un heap temporal.`,
        highlights: children.map(t => t.id)
    });
    
    let finalTrees = binomialUnion(remainingTrees, children, steps, "Unión tras extraer mínimo");
    steps.push({
        trees: finalTrees.map(t => t.clone()),
        desc: `Extracción del mínimo completada. El heap queda consolidado.`,
        highlights: []
    });
    return { finalTrees, steps };
}

// --- HEAP TYPE 2: FIBONACCI HEAP ---

function generateFibonacciInsertSteps(trees, val) {
    let steps = [];
    let roots = trees.map(t => t.clone());
    let newNode = new HeapNode(val);
    roots.push(newNode);
    
    steps.push({
        trees: roots.map(t => t.clone()),
        desc: `<strong>Insertar ${val}:</strong> En un Heap de Fibonacci, simplemente añadimos el nuevo elemento a la lista de raíces de forma perezosa (Lazy Insert).`,
        highlights: [newNode.id]
    });
    return { finalTrees: roots, steps };
}

function generateFibonacciExtractMinSteps(trees) {
    let steps = [];
    if (trees.length === 0) return { finalTrees: [], steps: [] };
    
    // Find min
    let minNode = null;
    for (let t of trees) {
        if (!minNode || t.val < minNode.val) minNode = t;
    }
    
    steps.push({
        trees: trees.map(t => t.clone()),
        desc: `Identificamos la raíz mínima global en la lista de raíces: <strong>${minNode.val}</strong>.`,
        highlights: [minNode.id]
    });
    
    // Remove min, add children to root list
    let remainingRoots = trees.filter(t => t.id !== minNode.id).map(t => t.clone());
    let children = minNode.children.map(t => t.clone());
    let mergedRoots = remainingRoots.concat(children);
    
    steps.push({
        trees: mergedRoots.map(t => t.clone()),
        desc: `Eliminamos la raíz mínima <strong>${minNode.val}</strong>. Colocamos todos sus hijos en la lista circular de raíces principales.`,
        highlights: children.map(t => t.id)
    });
    
    // Consolidate roots of same degree
    let A = new Array(20).fill(null);
    let currentRoots = mergedRoots.map(t => t.clone());
    
    steps.push({
        trees: currentRoots.map(t => t.clone()),
        desc: `Iniciamos la <strong>Consolidación</strong>: recorreremos la lista de raíces y fusionaremos árboles que tengan el mismo grado (número de hijos).`,
        highlights: []
    });
    
    for (let i = 0; i < currentRoots.length; i++) {
        let x = currentRoots[i];
        if (!x) continue;
        
        let d = x.order;
        
        // Show current root being analyzed
        steps.push({
            trees: rebuildDisplayRoots(A, currentRoots.slice(i)),
            desc: `Analizamos raíz <strong>${x.val}</strong> de grado ${d}.`,
            highlights: [x.id]
        });
        
        while (A[d] !== null) {
            let y = A[d];
            steps.push({
                trees: rebuildDisplayRoots(A, currentRoots.slice(i)),
                desc: `Conflicto de grados: <strong>${x.val}</strong> y <strong>${y.val}</strong> tienen grado ${d}. Los fusionamos.`,
                highlights: [x.id, y.id],
                compare: [x.id, y.id]
            });
            
            let parent, child;
            if (x.val <= y.val) {
                parent = x; child = y;
            } else {
                parent = y; child = x;
            }
            
            // Link: child becomes child of parent
            parent.children.push(child);
            parent.order++;
            child.marked = false;
            
            steps.push({
                trees: rebuildDisplayRoots(A, currentRoots.slice(i), parent),
                desc: `El mayor (<strong>${child.val}</strong>) se convierte en hijo del menor (<strong>${parent.val}</strong>). El grado de ${parent.val} incrementa a ${parent.order}.`,
                highlights: [parent.id]
            });
            
            A[d] = null;
            x = parent;
            d = x.order;
        }
        A[d] = x;
    }
    
    let finalTrees = A.filter(t => t !== null);
    steps.push({
        trees: finalTrees.map(t => t.clone()),
        desc: `Consolidación terminada. La lista de raíces final contiene solo árboles con grados únicos. El puntero al mínimo se actualiza.`,
        highlights: []
    });
    
    return { finalTrees, steps };
}

function rebuildDisplayRoots(A, remaining, activeParent = null) {
    let list = [];
    for (let t of A) {
        if (t) list.push(t.clone());
    }
    if (activeParent) {
        // prevent adding if it is already in remaining
        if (!remaining.some(r => r && r.id === activeParent.id)) {
            list.push(activeParent.clone());
        }
    }
    for (let t of remaining) {
        if (t && (!activeParent || t.id !== activeParent.id)) {
            list.push(t.clone());
        }
    }
    return list;
}

// --- HEAP TYPE 3: LEFTIST HEAP (IZQUIERDISTA) ---

function mergeLeftist(h1, h2, steps, descTitle) {
    if (!h1) return h2;
    if (!h2) return h1;
    
    steps.push({
        trees: [h1.clone(), h2.clone()],
        desc: `${descTitle}: Comparamos las raíces <strong>${h1.val}</strong> y <strong>${h2.val}</strong>. La menor quedará arriba.`,
        highlights: [h1.id, h2.id],
        compare: [h1.id, h2.id]
    });
    
    let root = h1;
    let other = h2;
    if (h1.val > h2.val) {
        root = h2;
        other = h1;
    }
    
    steps.push({
        trees: [root.clone(), other.clone()],
        desc: `La menor es <strong>${root.val}</strong>. Fusionamos recursivamente su rama derecha con el subárbol de raíz <strong>${other.val}</strong>.`,
        highlights: [root.id, other.id]
    });
    
    root.right = mergeLeftist(root.right, other, steps, descTitle);
    
    // Check leftist property
    let leftDist = root.left ? root.left.dist : -1;
    let rightDist = root.right ? root.right.dist : -1;
    
    steps.push({
        trees: [root.clone()],
        desc: `Evaluamos NPL en nodo <strong>${root.val}</strong>: NPL(izq) = ${leftDist}, NPL(der) = ${rightDist}.`,
        highlights: [root.id]
    });
    
    if (leftDist < rightDist) {
        steps.push({
            trees: [root.clone()],
            desc: `¡Violación izquierdista! NPL(izq) < NPL(der) (${leftDist} < ${rightDist}). Intercambiamos los hijos del nodo <strong>${root.val}</strong>.`,
            highlights: [root.id]
        });
        
        let temp = root.left;
        root.left = root.right;
        root.right = temp;
    }
    
    // Update distance
    root.dist = 1 + (root.right ? root.right.dist : -1);
    
    steps.push({
        trees: [root.clone()],
        desc: `NPL de <strong>${root.val}</strong> actualizado a 1 + NPL(der) = <strong>${root.dist}</strong>.`,
        highlights: [root.id]
    });
    
    return root;
}

function generateLeftistInsertSteps(root, val) {
    let steps = [];
    let tempNode = new HeapNode(val);
    
    if (!root) {
        steps.push({
            trees: [tempNode.clone()],
            desc: `<strong>Insertar ${val}</strong>: El heap estaba vacío. Creamos el nodo raíz.`,
            highlights: [tempNode.id]
        });
        return { finalTrees: [tempNode], steps };
    }
    
    steps.push({
        trees: [root.clone(), tempNode.clone()],
        desc: `<strong>Insertar ${val}</strong>: Creamos un nodo para ${val} y lo fusionamos con el heap existente.`,
        highlights: [tempNode.id]
    });
    
    let finalRoot = mergeLeftist(root.clone(), tempNode, steps, `Insertar ${val}`);
    
    steps.push({
        trees: [finalRoot.clone()],
        desc: `Inserción de <strong>${val}</strong> finalizada.`,
        highlights: []
    });
    
    return { finalTrees: [finalRoot], steps };
}

function generateLeftistExtractMinSteps(root) {
    let steps = [];
    if (!root) return { finalTrees: [], steps: [] };
    
    steps.push({
        trees: [root.clone()],
        desc: `La raíz contiene el elemento mínimo: <strong>${root.val}</strong>. Procedemos a eliminarla.`,
        highlights: [root.id]
    });
    
    let left = root.left ? root.left.clone() : null;
    let right = root.right ? root.right.clone() : null;
    
    let display = [];
    if (left) display.push(left);
    if (right) display.push(right);
    
    steps.push({
        trees: display.map(t => t.clone()),
        desc: `Eliminamos la raíz. Sus hijos izquierdo (<strong>${left ? left.val : 'ninguno'}</strong>) y derecho (<strong>${right ? right.val : 'ninguno'}</strong>) se separan como dos heaps independientes.`,
        highlights: display.map(t => t.id)
    });
    
    if (!left && !right) {
        steps.push({
            trees: [],
            desc: "El heap ahora está vacío.",
            highlights: []
        });
        return { finalTrees: [], steps };
    }
    
    let finalRoot = mergeLeftist(left, right, steps, "Unión tras extraer mínimo");
    steps.push({
        trees: [finalRoot.clone()],
        desc: `Extracción completada. El leftist heap resultante está balanceado.`,
        highlights: []
    });
    return { finalTrees: [finalRoot], steps };
}

// --- HEAP TYPE 4: SKEW HEAP (OBLICUO) ---

function mergeSkew(h1, h2, steps, descTitle) {
    if (!h1) return h2;
    if (!h2) return h1;
    
    steps.push({
        trees: [h1.clone(), h2.clone()],
        desc: `${descTitle}: Comparamos raíces: <strong>${h1.val}</strong> y <strong>${h2.val}</strong>.`,
        highlights: [h1.id, h2.id],
        compare: [h1.id, h2.id]
    });
    
    let root = h1;
    let other = h2;
    if (h1.val > h2.val) {
        root = h2;
        other = h1;
    }
    
    steps.push({
        trees: [root.clone(), other.clone()],
        desc: `La menor es <strong>${root.val}</strong>. Fusionamos recursivamente su hijo derecho con el otro heap.`,
        highlights: [root.id, other.id]
    });
    
    let mergedRight = mergeSkew(root.right, other, steps, descTitle);
    
    steps.push({
        trees: [root.clone()],
        desc: `En Skew Heap, **intercambiamos incondicionalmente** el hijo izquierdo y derecho del nodo <strong>${root.val}</strong>.`,
        highlights: [root.id]
    });
    
    root.right = root.left;
    root.left = mergedRight;
    
    steps.push({
        trees: [root.clone()],
        desc: `Intercambio completo en <strong>${root.val}</strong>. El subárbol fusionado se movió a la izquierda.`,
        highlights: [root.id]
    });
    
    return root;
}

function generateSkewInsertSteps(root, val) {
    let steps = [];
    let tempNode = new HeapNode(val);
    
    if (!root) {
        steps.push({
            trees: [tempNode.clone()],
            desc: `<strong>Insertar ${val}</strong>: El heap estaba vacío. Creamos el nodo raíz.`,
            highlights: [tempNode.id]
        });
        return { finalTrees: [tempNode], steps };
    }
    
    steps.push({
        trees: [root.clone(), tempNode.clone()],
        desc: `<strong>Insertar ${val}</strong>: Creamos un nodo para ${val} y lo fusionamos con el skew heap existente.`,
        highlights: [tempNode.id]
    });
    
    let finalRoot = mergeSkew(root.clone(), tempNode, steps, `Insertar ${val}`);
    steps.push({
        trees: [finalRoot.clone()],
        desc: `Inserción finalizada.`,
        highlights: []
    });
    return { finalTrees: [finalRoot], steps };
}

function generateSkewExtractMinSteps(root) {
    let steps = [];
    if (!root) return { finalTrees: [], steps: [] };
    
    steps.push({
        trees: [root.clone()],
        desc: `El mínimo es la raíz: <strong>${root.val}</strong>. Procedemos a eliminarla.`,
        highlights: [root.id]
    });
    
    let left = root.left ? root.left.clone() : null;
    let right = root.right ? root.right.clone() : null;
    
    let display = [];
    if (left) display.push(left);
    if (right) display.push(right);
    
    steps.push({
        trees: display.map(t => t.clone()),
        desc: `Eliminamos la raíz. Sus hijos izquierdo (<strong>${left ? left.val : 'ninguno'}</strong>) y derecho (<strong>${right ? right.val : 'ninguno'}</strong>) se separan.`,
        highlights: display.map(t => t.id)
    });
    
    if (!left && !right) {
        return { finalTrees: [], steps };
    }
    
    let finalRoot = mergeSkew(left, right, steps, "Unión tras extraer mínimo");
    steps.push({
        trees: [finalRoot.clone()],
        desc: `Extracción completada. El skew heap queda consolidado.`,
        highlights: []
    });
    return { finalTrees: [finalRoot], steps };
}

// --- HEAP TYPE 5: PAIRING HEAP (EMPAREJAMIENTO) ---

function mergePairing(h1, h2) {
    if (!h1) return h2;
    if (!h2) return h1;
    if (h1.val <= h2.val) {
        h1.children.unshift(h2); // Add as leftmost child
        return h1;
    } else {
        h2.children.unshift(h1);
        return h2;
    }
}

function generatePairingInsertSteps(root, val) {
    let steps = [];
    let tempNode = new HeapNode(val);
    
    if (!root) {
        steps.push({
            trees: [tempNode.clone()],
            desc: `<strong>Insertar ${val}</strong>: El heap estaba vacío. Creamos el nodo raíz.`,
            highlights: [tempNode.id]
        });
        return { finalTrees: [tempNode], steps };
    }
    
    steps.push({
        trees: [root.clone(), tempNode.clone()],
        desc: `<strong>Insertar ${val}</strong>: Creamos el nodo <strong>${val}</strong> y lo fusionamos con la raíz.`,
        highlights: [tempNode.id]
    });
    
    steps.push({
        trees: [root.clone(), tempNode.clone()],
        desc: `Comparamos raíces: <strong>${root.val}</strong> y <strong>${val}</strong>.`,
        highlights: [root.id, tempNode.id],
        compare: [root.id, tempNode.id]
    });
    
    let finalRoot = mergePairing(root.clone(), tempNode);
    
    steps.push({
        trees: [finalRoot.clone()],
        desc: `El menor es <strong>${finalRoot.val}</strong>. El nodo mayor pasa a ser su primer hijo. Inserción completada en <code>O(1)</code>.`,
        highlights: [finalRoot.id]
    });
    
    return { finalTrees: [finalRoot], steps };
}

function generatePairingExtractMinSteps(root) {
    let steps = [];
    if (!root) return { finalTrees: [], steps: [] };
    
    steps.push({
        trees: [root.clone()],
        desc: `Extraemos la raíz mínima: <strong>${root.val}</strong>. Sus subárboles hijos deben unirse.`,
        highlights: [root.id]
    });
    
    let children = root.children.map(c => c.clone());
    if (children.length === 0) {
        steps.push({
            trees: [],
            desc: "El heap ahora está vacío.",
            highlights: []
        });
        return { finalTrees: [], steps };
    }
    
    steps.push({
        trees: children.map(c => c.clone()),
        desc: `Los hijos resultantes son: ${children.map(c => c.val).join(', ')}. Iniciamos la **Pasada 1** (Emparejamiento de izquierda a derecha).`,
        highlights: children.map(c => c.id)
    });
    
    // Pass 1: left-to-right merges in pairs
    let pairs = [];
    for (let i = 0; i < children.length; i += 2) {
        if (i + 1 < children.length) {
            let h1 = children[i];
            let h2 = children[i+1];
            
            steps.push({
                trees: children.slice(i).concat(pairs).map(t => t.clone()),
                desc: `Pasada 1: Fusionamos la pareja contigua <strong>${h1.val}</strong> y <strong>${h2.val}</strong>.`,
                highlights: [h1.id, h2.id],
                compare: [h1.id, h2.id]
            });
            
            let merged = mergePairing(h1.clone(), h2.clone());
            pairs.push(merged);
            
            steps.push({
                trees: children.slice(i+2).concat(pairs).map(t => t.clone()),
                desc: `El menor es <strong>${merged.val}</strong>. Agregamos el árbol resultante al conjunto de parejas.`,
                highlights: [merged.id]
            });
        } else {
            // Odd element
            pairs.push(children[i]);
            steps.push({
                trees: pairs.map(t => t.clone()),
                desc: `El nodo <strong>${children[i].val}</strong> no tiene pareja. Pasa directamente a la siguiente ronda.`,
                highlights: [children[i].id]
            });
        }
    }
    
    // Pass 2: right-to-left accumulation
    if (pairs.length > 0) {
        let curr = pairs[pairs.length - 1].clone();
        
        steps.push({
            trees: pairs.map(t => t.clone()),
            desc: `Iniciamos la **Pasada 2**: Fusionaremos los árboles de derecha a izquierda de forma acumulada.`,
            highlights: []
        });
        
        for (let i = pairs.length - 2; i >= 0; i--) {
            let other = pairs[i].clone();
            
            steps.push({
                trees: [curr.clone(), other.clone()],
                desc: `Pasada 2: Fusionamos el acumulado (raíz <strong>${curr.val}</strong>) con el árbol de la izquierda (raíz <strong>${other.val}</strong>).`,
                highlights: [curr.id, other.id],
                compare: [curr.id, other.id]
            });
            
            curr = mergePairing(curr, other);
            
            steps.push({
                trees: [curr.clone()],
                desc: `Nuevo resultado acumulado con raíz <strong>${curr.val}</strong>.`,
                highlights: [curr.id]
            });
        }
        
        steps.push({
            trees: [curr.clone()],
            desc: `Extracción completada. El nuevo Pairing Heap consolidado tiene raíz <strong>${curr.val}</strong>.`,
            highlights: []
        });
        
        return { finalTrees: [curr], steps };
    }
    
    return { finalTrees: [], steps };
}

// --- Dynamic Theory Binomial trees drawer ---
function drawTheoryBinomialTrees() {
    const svg = document.getElementById('binomial-construct-svg');
    if (!svg) return;
    
    // Create B0
    let b0 = new HeapNode(12);
    
    // Create B1
    let b1 = new HeapNode(8);
    b1.children.push(new HeapNode(15));
    b1.order = 1;
    
    // Create B2
    let b2 = new HeapNode(5);
    let b2_child0 = new HeapNode(14);
    let b2_child1 = new HeapNode(20);
    b2_child1.children.push(new HeapNode(27));
    b2_child1.order = 1;
    b2.children.push(b2_child0);
    b2.children.push(b2_child1);
    b2.order = 2;
    
    // Create B3
    let b3 = new HeapNode(2);
    let b3_child0 = new HeapNode(10);
    let b3_child1 = new HeapNode(6);
    b3_child1.children.push(new HeapNode(18));
    b3_child1.order = 1;
    let b3_child2 = new HeapNode(22);
    let b3_child2_0 = new HeapNode(30);
    let b3_child2_1 = new HeapNode(25);
    b3_child2_1.children.push(new HeapNode(35));
    b3_child2_1.order = 1;
    b3_child2.children.push(b3_child2_0);
    b3_child2.children.push(b3_child2_1);
    b3_child2.order = 2;
    b3.children.push(b3_child0);
    b3.children.push(b3_child1);
    b3.children.push(b3_child2);
    b3.order = 3;
    
    const trees = [b0, b1, b2, b3];
    
    // Temporarily set selectedHeapType to binomial for drawing the orders
    let prevType = selectedHeapType;
    selectedHeapType = 'binomial';
    drawHeapInSvg(svg, trees, [], [], 110);
    selectedHeapType = prevType;
}

// --- App State & Simulation Controllers ---

let selectedHeapType = "binomial"; // binomial, fibonacci, leftist, skew, pairing
let currentHeapState = []; // Forest representing current heap: array of trees
let simulationSteps = [];
let currentStepIndex = 0;
let playInterval = null;
let simulationSpeed = 1000;

// DOM Elements
const navTabs = document.getElementById('nav-tabs');
const tabPanels = document.querySelectorAll('.tab-panel');
const tabButtons = document.querySelectorAll('.tab-btn');
const subtabPanels = document.querySelectorAll('.subtab-panel');
const subtabButtons = document.querySelectorAll('.sub-tab-btn');

const btnStartSim = document.getElementById('btn-start-sim');
const logoMain = document.getElementById('logo-main');

const heapSelect = document.getElementById('heap-type-select');
const btnUfpsExample = document.getElementById('btn-ufps-example');

const inputInsert = document.getElementById('insert-val');
const btnInsert = document.getElementById('btn-insert');
const btnExtract = document.getElementById('btn-extract');
const btnRandom = document.getElementById('btn-random');
const btnClear = document.getElementById('btn-clear');

const btnPrev = document.getElementById('btn-prev');
const btnPlay = document.getElementById('btn-play');
const btnNext = document.getElementById('btn-next');
const speedRange = document.getElementById('speed-range');
const speedLabel = document.getElementById('speed-label');

const stepIndicator = document.getElementById('step-indicator');
const stepDesc = document.getElementById('step-desc');
const canvasPlaceholder = document.getElementById('canvas-placeholder');
const heapSvg = document.getElementById('heap-svg');

// Navigation / Tabs
function switchTab(tabId) {
    tabButtons.forEach(btn => {
        const isMatch = btn.getAttribute('data-tab') === tabId;
        btn.classList.toggle('active', isMatch);
        btn.setAttribute('aria-selected', isMatch);
    });
    tabPanels.forEach(panel => {
        panel.classList.toggle('active', panel.id === `panel-${tabId}`);
    });
    if (tabId !== 'simulator') {
        stopAutoplay();
    }
}

navTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (btn) switchTab(btn.getAttribute('data-tab'));
});
btnStartSim.addEventListener('click', () => switchTab('simulator'));
logoMain.addEventListener('click', () => switchTab('home'));

// Subtabs (Theory: Binomial / Fibonacci / Leftist / Skew / Pairing)
subtabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        subtabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const targetId = btn.getAttribute('data-subtab');
        subtabPanels.forEach(p => {
            p.style.display = (p.id === targetId) ? 'block' : 'none';
        });
    });
});

// Selector handler
heapSelect.addEventListener('change', (e) => {
    selectedHeapType = e.target.value;
    stopAutoplay();
    clearHeapState();
    
    // Update placeholder text
    const names = {
        binomial: "Heap Binomial",
        fibonacci: "Heap de Fibonacci",
        leftist: "Leftist Heap (Izquierdista)",
        skew: "Skew Heap (Oblicuo)",
        pairing: "Pairing Heap (Emparejamiento)"
    };
    document.getElementById('canvas-status-title').textContent = `Lienzo de ${names[selectedHeapType]} Listo`;
});

function clearHeapState() {
    currentHeapState = [];
    simulationSteps = [];
    currentStepIndex = 0;
    updateSimUI();
}

// UI State Updater
function updateSimUI() {
    if (simulationSteps.length === 0) {
        btnPrev.disabled = true;
        btnNext.disabled = true;
        btnPlay.disabled = true;
        stepIndicator.textContent = "Paso 0/0";
        stepDesc.innerHTML = "El heap está vacío. Selecciona una estructura e inserta valores o carga el ejemplo UFPS.";
        canvasPlaceholder.style.display = 'block';
        heapSvg.innerHTML = '';
        return;
    }
    
    canvasPlaceholder.style.display = 'none';
    
    const step = simulationSteps[currentStepIndex];
    drawHeapInSvg(heapSvg, step.trees, step.highlights, step.compare || []);
    
    stepIndicator.textContent = `Paso ${currentStepIndex + 1}/${simulationSteps.length}`;
    stepDesc.innerHTML = step.desc;
    
    btnPrev.disabled = currentStepIndex === 0;
    btnNext.disabled = currentStepIndex === simulationSteps.length - 1;
    btnPlay.disabled = simulationSteps.length <= 1;
    
    if (currentStepIndex === simulationSteps.length - 1) {
        stopAutoplay();
    }
}

function startSimulation(res) {
    simulationSteps = res.steps;
    currentStepIndex = 0;
    currentHeapState = res.finalTrees;
    updateSimUI();
}

function nextStep() {
    if (currentStepIndex < simulationSteps.length - 1) {
        currentStepIndex++;
        updateSimUI();
    }
}

function prevStep() {
    if (currentStepIndex > 0) {
        currentStepIndex--;
        updateSimUI();
    }
}

function toggleAutoplay() {
    if (playInterval) {
        stopAutoplay();
    } else {
        btnPlay.textContent = "Pausar";
        btnPlay.classList.remove('btn-accent');
        playInterval = setInterval(() => {
            if (currentStepIndex < simulationSteps.length - 1) {
                nextStep();
            } else {
                stopAutoplay();
            }
        }, simulationSpeed);
    }
}

function stopAutoplay() {
    if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
        btnPlay.textContent = "Reproducir";
        btnPlay.classList.add('btn-accent');
    }
}

// Generate steps dynamically based on Heap Type
function generateInsertSteps(trees, val) {
    switch (selectedHeapType) {
        case 'binomial':
            return generateBinomialInsertSteps(trees, val);
        case 'fibonacci':
            return generateFibonacciInsertSteps(trees, val);
        case 'leftist':
            return generateLeftistInsertSteps(trees[0], val);
        case 'skew':
            return generateSkewInsertSteps(trees[0], val);
        case 'pairing':
            return generatePairingInsertSteps(trees[0], val);
    }
}

function generateExtractMinSteps(trees) {
    switch (selectedHeapType) {
        case 'binomial':
            return generateBinomialExtractMinSteps(trees);
        case 'fibonacci':
            return generateFibonacciExtractMinSteps(trees);
        case 'leftist':
            return generateLeftistExtractMinSteps(trees[0]);
        case 'skew':
            return generateSkewExtractMinSteps(trees[0]);
        case 'pairing':
            return generatePairingExtractMinSteps(trees[0]);
    }
}

// Operations Handlers
btnInsert.addEventListener('click', () => {
    const val = parseInt(inputInsert.value, 10);
    if (isNaN(val) || val < 0 || val > 99) {
        alert("Ingresa un número válido (0-99).");
        return;
    }
    stopAutoplay();
    let res = generateInsertSteps(currentHeapState, val);
    startSimulation(res);
    inputInsert.value = '';
    inputInsert.focus();
});

inputInsert.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnInsert.click();
});

btnExtract.addEventListener('click', () => {
    if (currentHeapState.length === 0 || (currentHeapState.length === 1 && currentHeapState[0] === null)) {
        alert("El heap está vacío.");
        return;
    }
    stopAutoplay();
    let res = generateExtractMinSteps(currentHeapState);
    startSimulation(res);
});

btnClear.addEventListener('click', () => {
    stopAutoplay();
    clearHeapState();
});

// Load UFPS Example: [1, 3, 2, 9, 5, 7, 8, 4]
btnUfpsExample.addEventListener('click', () => {
    stopAutoplay();
    
    let arr = [1, 3, 2, 9, 5, 7, 8, 4];
    let stepsAcc = [];
    let stateAcc = [];
    
    for (let v of arr) {
        let res = generateInsertSteps(stateAcc, v);
        stepsAcc = stepsAcc.concat(res.steps);
        stateAcc = res.finalTrees;
    }
    
    currentHeapState = stateAcc;
    simulationSteps = stepsAcc;
    
    // Start simulation at the first step so the user can see it build up!
    currentStepIndex = 0;
    updateSimUI();
});

// Random Generator
btnRandom.addEventListener('click', () => {
    stopAutoplay();
    let count = 5 + Math.floor(Math.random() * 3);
    let values = [];
    while (values.length < count) {
        let v = Math.floor(Math.random() * 90) + 5;
        if (!values.includes(v)) values.push(v);
    }
    
    let stepsAcc = [];
    let stateAcc = [];
    for (let v of values) {
        let res = generateInsertSteps(stateAcc, v);
        stepsAcc = stepsAcc.concat(res.steps);
        stateAcc = res.finalTrees;
    }
    
    currentHeapState = stateAcc;
    simulationSteps = stepsAcc;
    currentStepIndex = stepsAcc.length - 1; // start by showing final generated state
    updateSimUI();
});

// Player Controls
btnPrev.addEventListener('click', prevStep);
btnNext.addEventListener('click', nextStep);
btnPlay.addEventListener('click', toggleAutoplay);

speedRange.addEventListener('input', (e) => {
    simulationSpeed = parseInt(e.target.value, 10);
    speedLabel.textContent = `${(simulationSpeed / 1000).toFixed(1)}s`;
    if (playInterval) {
        stopAutoplay();
        toggleAutoplay();
    }
});

// --- Initial Setup on Page Load ---
window.addEventListener('DOMContentLoaded', () => {
    drawTheoryBinomialTrees();
    updateSimUI();
});

window.addEventListener('resize', () => {
    if (simulationSteps.length > 0) updateSimUI();
    drawTheoryBinomialTrees();
});
