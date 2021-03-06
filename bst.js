function Tree(key) {
    this.key = key;
    this.left = this.right = null;
    this.N = 1;  // size of tree
    this.x = this.y = 0.0;  // current position
    this.dx = 0.0;
    this.oldx = this.oldy = 0; // previous position (for animation)
}

function treeSize(tree) {
    return tree === null ? 0 : tree.N;
}

function insert(tree, key) {
    if (tree == null) {
        tree = new Tree(key);
    } else {
        if (key < tree.key) {
            tree.left = insert(tree.left, key);
            tree.N = 1 + treeSize(tree.left) + treeSize(tree.right);
        } else if (key > tree.key) {
            tree.right = insert(tree.right, key);
            tree.N = 1 + treeSize(tree.left) + treeSize(tree.right);
        }
    }
    return tree;
} 

function insertRoot(tree, key) {
    if (tree == null) {
        tree = new Tree(key);
    } else if (key < tree.key) {
        tree.left = insertRoot(tree.left, key);
        tree = rotR(tree);
    } else if (key > tree.key) {
        tree.right = insertRoot(tree.right, key);
        tree = rotL(tree);
    }
    return tree;
}

function insertRandom(tree, key) {
    if (tree == null) {
        tree = new Tree(key);
        tree.N = 1;
    } else if (Math.random()*(tree.N + 1) < 1) {
        tree = insertRoot(tree, key, val);
    } else if (key < tree.key) {
        tree.left = insertRandom(tree.left, key, val);
        tree.N = 1 + treeSize(tree.left) + treeSize(tree.right);
    } else if (key > tree.key) {
        tree.right = insertRandom(tree.right, key, val);
        tree.N = 1 + treeSize(tree.left) + treeSize(tree.right);
    }
    return tree;
}

function find(tree, key) {
    if (tree === null)
        return false;
    if (tree.key === key)
        return true;
    if (key < tree.key)
        return find(tree.left, key);
    return find(tree.right, key);
}

//
// Note: does *not* recompute size (don't use with randomInsert).
//
function remove(tree, key) {
    if (tree != null) {
        if (key === tree.key) {
            if (tree.left === null)
                tree = tree.right;
            else if (tree.right === null)
                tree = tree.left;
            else {
                var nodeWithKey = new Tree(0);
                tree.right = removeMin(tree.right, nodeWithKey);
                tree.key = nodeWithKey.key;
                tree.x = nodeWithKey.x;
                tree.y = nodeWithKey.y;
            }
        }  else if (key < tree.key) {
            tree.left = remove(tree.left, key);
        } else {
            tree.right = remove(tree.right, key);
        }
    }
    return tree;
}

function removeMin(tree, nodeWithKey) {
    if (tree.left === null) {
        nodeWithKey.key = tree.key;
        nodeWithKey.x = tree.x;
        nodeWithKey.y = tree.y;
        return tree.right;
    }
    tree.left = removeMin(tree.left, nodeWithKey);
    return tree;
}

function joinRandom(X, Y) {
    if (X === null)
        return Y;
    if (Y === null)
        return X;
    if (Math.random()*(X.N + Y.N) < X.N) {
        X.right = joinRandom(X.right, Y);
        X.N = 1 + treeSize(X.left) + treeSize(X.right);
        return X;
    } else {
        Y.left = joinRandom(X, Y.left);
        Y.N = treeSize(Y.left) + treeSize(Y.right);
        return Y;
    }
}

function removeRandom(tree, key) {
    if (tree === null)
        return null;
    if (key === tree.key) {
        return joinRandom(tree.left, tree.right);
    }
    if (key < tree.key) {
        tree.left = removeRandom(tree.left, key)
    } else if (key > tree.right) {
        tree.right = removeRandom(tree.right, key);
    }
    tree.N = 1 + treeSize(tree.left) + treeSize(tree.right);
    return tree;
}

function rotR(t) {
    var r = t.left;
    t.left = r.right;
    r.right = t;
    t.N = 1 + treeSize(t.left) + treeSize(t.right);
    r.N = 1 + treeSize(r.left) + t.N;
    return r;
}

function rotL(t) {
    var r = t.right;
    t.right = r.left;
    r.left = t;
    t.N = 1 + treeSize(t.left) + treeSize(t.right);
    r.N = 1 + t.N + treeSize(r.right);
    return r;
}

//
// root = root of tree in which rotation occurs (possible in deep subtree).
// node = top node in rotation
//
function rotateRight(root, node) {
    if (root === null)
        return root; // shouldn't happen
    if (root === node)
        root = rotR(node);
    else if (node.key < root.key)
        root.left = rotateRight(root.left, node);
    else 
        root.right = rotateRight(root.right, node);
    return root;
}

function rotateLeft(root, node) {
    if (root === null)
        return root; // shouldn't happen
    if (root === node)
        root = rotL(node);
    else if (node.key < root.key)
        root.left = rotateLeft(root.left, node);
    else 
        root.right = rotateLeft(root.right, node);
    return root;
}

function height(tree) {
    if (tree == null)
        return -1;
    return 1 + Math.max(height(tree.left),
                        height(tree.right))
}

function setNodePositions(tree) {

    function rightContour(tree, y, x, contour) {
        if (tree != null) {
            x += tree.dx;
            if (x > contour[y])
                contour[y] = x;
            rightContour(tree.left, y+1, x, contour);
            rightContour(tree.right, y+1, x, contour);
        }
    }

    function leftContour(tree, y, x, contour) {
        if (tree != null) {
            x += tree.dx;
            if (x < contour[y])
                contour[y] = x;
            leftContour(tree.left, y+1, x, contour);
            leftContour(tree.right, y+1, x, contour);
        }
    }

    function childOffsets(tree) {
        if (tree != null) {
            if (tree.left == null) {
                if (tree.right != null) {
                    childOffsets(tree.right);
                    tree.right.dx = 1;
                }
            } else if (tree.right == null) {
                childOffsets(tree.left);
                tree.left.dx = -1;
            } else {
                childOffsets(tree.left);
                childOffsets(tree.right);
                
                var HUGE = 1e6;
                
                var lh = height(tree.left);
                var rcontour = new Array(lh+1);
                for (var i = 0; i <= lh; i++)
                    rcontour[i] = -HUGE;
                rightContour(tree.left, 0,0, rcontour);
                
                var rh = height(tree.right);
                var lcontour = new Array(rh+1);
                for (var i = 0; i <= rh; i++)
                    lcontour[i] = HUGE;
                leftContour(tree.right, 0,0, lcontour);
                
                var yend = ((lh < rh) ? lh : rh) + 1;
                var smin = 0.0;
                for (var y = 1; y < yend; y++) {
                    var s = lcontour[y] - rcontour[y];
                    if (s < smin)
                        smin = s;
                }
                var d = 2 - smin;
                tree.left.dx = -d/2;
                tree.right.dx = d/2;
            }
        }
    }

    //
    // Save old node coords (i.e. copy x,y to oldx, oldy) and
    // zero coords (x, y) which are about to be update.
    //
    function saveAndZeroCoords(tree) {
        if (tree) {
            tree.oldx = tree.x;  
            tree.oldy = tree.y;
            tree.x = tree.y = tree.dx = 0;
            saveAndZeroCoords(tree.left);
            saveAndZeroCoords(tree.right);
        }
    }

    function assignCoordinates(tree, x, y, extent) {
        if (tree != null) {
            tree.x = x + tree.dx;
            if (tree.x < extent.minx)
                extent.minx = tree.x;
            if (tree.x > extent.maxx)
                extent.maxx = tree.x;
            tree.y = y;
            assignCoordinates(tree.left, tree.x, y+1, extent);
            assignCoordinates(tree.right, tree.x, y+1, extent);
        }
    }

    saveAndZeroCoords(tree);
    childOffsets(tree);
    var extent = {minx : 0, maxx : 1, miny : 0, maxy : height(tree)};
    assignCoordinates(tree, 0, 0, extent);
    return extent;
}

    
