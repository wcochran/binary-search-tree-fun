function Tree(key) {
    this.key = key;
    this.left = this.right = null;
    this.x = this.y = 0.0;  // current position
    this.dx = 0.0;
    this.oldx = this.oldy = 0; // previous position (for animation)
}

function insert(tree, key) {
    if (tree == null) {
	tree = new Tree(key);
    } else {
	if (key < tree.key)
	    tree.left = insert(tree.left, key);
	else
	    tree.right = insert(tree.right, key);
    }
    return tree;
}    

function rotR(t) {
    var r = t.left;
    t.left = r.right;
    r.right = t;
    return r;
}

function rotL(t) {
    var r = t.right;
    t.right = r.left;
    r.left = t;
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

    
