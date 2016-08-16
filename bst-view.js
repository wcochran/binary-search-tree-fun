var bstView = (function() {
    var my = {};       // returned object holding module methods

    var tree = null;   // Binary Search Tree (see setTree()) below)
    var treeModified;  // true => recompute tree layout

    var canvas;
    var gl;
    var program;

    var viewrect = {};   // 2D viewable region (set lazily in display())
    var selectedNodes = [];

    var frame = 0;  // requested frame

    function getMousePos(canvas, event) {
	var rect = canvas.getBoundingClientRect();
	return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
	};
    }

    function canvasToViewRect(pt) {
	return {
	    x: pt.x*viewrect.width/canvas.width + viewrect.x0,
	    y: pt.y*viewrect.height/canvas.height + viewrect.y0
	};
    }

    function viewRectToCanvas(pt) {
	return {
	    x : (pt.x - viewrect.x0)/canvas.width/viewrect.width,
	    y : (pt.y - viewrect.y0)/canvas.height/viewrect.height
	};
    }

    var draggingNode = null;

    function mouseDown(event) {
	var pos = getMousePos(canvas, event);
	var vpos = canvasToViewRect(pos);
	var node = findNode(tree, vpos);
	if (node) {
            draggingNode = node;
        }
    }

    function mouseMove(event) {
	if (draggingNode) {
	    var pos = getMousePos(canvas, event);
	    var vpos = canvasToViewRect(pos);
	    draggingNode.x = vpos.x;
	    draggingNode.y = vpos.y;
	    if (frame == 0) {
		frame = requestAnimationFrame(display);
	    }
	}
    }

    function mouseUp(event) {
	if (draggingNode) {
	    draggingNode = null;
	    return;
	}

	var pos = getMousePos(canvas, event);
	var vpos = canvasToViewRect(pos);
	var node = findNode(tree, vpos);
	if (node) {
	    var index = selectedNodes.findIndex(
		function(elem, i, a){
		    return elem.key == node.key;
		});
	    if (index >= 0) {
		selectedNodes.splice(index, 1);
	    } else {
		selectedNodes.push(node);
	    }
	    if (frame == 0) {
		frame = requestAnimationFrame(display);
	    }
	}
    }

    my.init = function(canvas_) {
        canvas = canvas_;
	gl = null;
	try {
            gl = canvas.getContext("webgl");
	} catch(e) {gl = null;}
	if (gl == null) {
            return false;
	}

	canvas.addEventListener("mousedown", mouseDown, false);
	canvas.addEventListener("mousemove", mouseMove, false);
	document.body.addEventListener("mouseup", mouseUp, false);

	var vertexShaderSource = 
	    'attribute vec3 vertexPosition; \
             uniform mat4 ModelViewProjection; \
             void main() { \
                gl_Position = ModelViewProjection*vec4(vertexPosition,1.0); \
             }';

	var fragmentShaderSource =
	    'precision mediump float; \
             uniform vec3 objectColor; \
             void main() { \
                gl_FragColor = vec4(objectColor, 1.0); \
             }';
	
	var vs = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vs,vertexShaderSource);
	gl.compileShader(vs);
	if (!gl.getShaderParameter(vs,gl.COMPILE_STATUS)) {
            return false; 
	}

	var fs = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fs,fragmentShaderSource);
	gl.compileShader(fs);
	if (!gl.getShaderParameter(fs,gl.COMPILE_STATUS)) {
            return false;
	}
	
	program = gl.createProgram();
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.linkProgram(program);
	
	gl.useProgram(program);
	
	program.vertexPosition = gl.getAttribLocation(program, "vertexPosition");
	program.ModelViewProjection = gl.getUniformLocation(program, 
							    "ModelViewProjection");
	program.objectColor = gl.getUniformLocation(program, "objectColor");
	
	gl.clearColor(0,0,0.3,1);
	gl.uniform3fv(program.objectColor,[1.0, 1.0, 0.0]);

	gl.matrixStack = new Matrix4x4Stack;      
	gl.Projection = new Matrix4x4;
	gl.ModelView = new Matrix4x4;
	
	gl.enable(gl.DEPTH_TEST);
	gl.lineWidth(2.0);

	return true;
    };

    my.setTree = function(tree_) {
	tree = tree_;
	treeModified = true;
    }

    function loadUniforms() {
        var ModelViewProjection = gl.Projection.mult(gl.ModelView);
        gl.uniformMatrix4fv(program.ModelViewProjection, false,
                            ModelViewProjection.array);
        gl.uniform3fv(program.objectColor, gl.objectColor);
    }
    
    var circle = {
	numVerts : 32,
	VBO : -1,
	loadVBO : function() {
	    var verts = new Float32Array(2*this.numVerts);
	    var dtheta = 2*Math.PI/this.numVerts;
	    for (var i = 0; i < this.numVerts; i++) {
		var theta = i*dtheta;
		verts[2*i] = Math.cos(theta);
		verts[2*i+1] = Math.sin(theta);
	    }
            this.VBO = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.VBO);
            gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
	},
	draw : function(x, y, radius) {
            if (this.VBO < 0)
		this.loadVBO();
	    gl.matrixStack.push(gl.ModelView);
	    gl.ModelView.translate(x,y,0).scale(radius, radius, 1);
            loadUniforms();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.VBO);
            gl.enableVertexAttribArray(program.vertexPosition);
            gl.vertexAttribPointer(program.vertexPosition,
                                   2, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.LINE_LOOP, 0, this.numVerts);
	    gl.matrixStack.pop(gl.ModelView);
	}
    }

    var lineSegment = {
	VBO : -1,
	loadVBO : function() {
	    var verts = new Float32Array([0,0, 1,0]);
            this.VBO = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.VBO);
            gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
	},
	draw : function(x0,y0, x1,y1) {
            if (this.VBO < 0)
		this.loadVBO();
	    gl.matrixStack.push(gl.ModelView);
	    var dx = x1 - x0, dy = y1 - y0;
	    var theta = Math.atan2(dy, dx)*180/Math.PI;
	    var len = Math.sqrt(dx*dx + dy*dy);
	    gl.ModelView.translate(x0,y0,0).rotate(theta,0,0,1).scale(len,1,1);
            loadUniforms();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.VBO);
            gl.enableVertexAttribArray(program.vertexPosition);
            gl.vertexAttribPointer(program.vertexPosition,
                                   2, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.LINES, 0, 2);
	    gl.matrixStack.pop(gl.ModelView);
	}
    }

    var digit = {  // positive y-axis is down
	vertsBuffer : -1,
	elementsBuffer : -1,
	elementOffset : [0, 8, 10, 20, 28, 36, 46, 56, 60, 70],
	elementCount : [8, 2, 10, 8, 8, 10, 10, 4, 10, 10],
	loadVBOs : function() {
	    var verts = new Float32Array([-5/16,-1, 0,-1, 5/16,-1,
					  -5/16, 0, 0, 0, 5/16, 0,
					  -5/16,+1, 0,+1, 5/16,+1]);
	    this.vertsBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertsBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
	    var elements = new Uint8Array([0,2, 2,8, 8,6, 6,0,       // 0, offset=0,  n=8
					   1,7,                      // 1, offset=8,  n=2
					   0,2, 2,5, 5,3, 3,6, 6,8,  // 2, offset=10, n=10
					   0,2, 2,8, 8,6, 5,3,       // 3, offset=20, n=8
					   0,3, 3,5, 5,2, 5,8,       // 4, offset=28, n=8
					   2,0, 0,3, 3,5, 5,8, 8,6,  // 5, offset=36, n=10
					   2,0, 0,6, 6,8, 8,5, 5,3,  // 6, offset=46, n=10
					   0,2, 2,8,                 // 7, offset=56, n=4
					   0,2, 2,8, 8,6, 6,0, 3,5,  // 8, offset=60, n=10
					   6,8, 8,2, 2,0, 0,3, 3,5]);// 9, offset=70, n=10
	    this.elementsBuffer = gl.createBuffer();
	    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.elementsBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, elements, gl.STATIC_DRAW);
	},
	draw : function(d) {
	    if (this.vertsBuffer < 0)
		this.loadVBOs();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertsBuffer);
            gl.enableVertexAttribArray(program.vertexPosition);
            gl.vertexAttribPointer(program.vertexPosition,
                                   2, gl.FLOAT, false, 0, 0);
	    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.elementsBuffer);
            gl.drawElements(gl.LINES, this.elementCount[d], gl.UNSIGNED_BYTE,
			    this.elementOffset[d]);
	},
	drawNumber : function(x, y, height, num) {	
	    gl.matrixStack.push(gl.ModelView);
	    if (num < 10) {  // single digit
		gl.ModelView.translate(x, y, 0).scale(height, height, 1);
		loadUniforms();
		this.draw(num);
	    } else {
		var v = num, len = 1;   // count digits
		while (v >= 10) {
		    v = Math.floor(v / 10);
		    len++;
		}
		gl.ModelView.translate(x, y, 0).scale(height, height, 1);
		gl.ModelView.translate((len-1)/2,0,0);
		while (num > 0) {
		    var d = num % 10;
		    loadUniforms();
		    this.draw(d);
		    num = Math.floor(num / 10);
		    gl.ModelView.translate(-1,0,0);
		}
	    }
	    gl.matrixStack.pop(gl.ModelView);
	}
    }

    var nodeRadius = 0.35;
    var textHeight = 0.18;
    var boundary = 0.7;

    function edge(x0,y0, x1,y1) {
	var dx = x1 - x0, dy = y1 - y0;
	var len = Math.sqrt(dx*dx + dy*dy);
	var u = dx/len, v = dy/len;
	lineSegment.draw(x0 + nodeRadius*u, y0 + nodeRadius*v,
			 x1 - nodeRadius*u, y1 - nodeRadius*v);
    }

    var selectedColor = [1, 0, 0];
    var normalColor = [1, 1, 0];

    function drawTree(tree) {
	var index = selectedNodes.findIndex(
	    function(elem, i, a){
		return elem.key == tree.key;
	    });
	gl.objectColor = (index >= 0) ? selectedColor : normalColor;
	digit.drawNumber(tree.x, tree.y, textHeight, tree.key);
	circle.draw(tree.x, tree.y, nodeRadius);
	if (tree.left != null) {
	    gl.objectColor = normalColor;
	    edge(tree.x, tree.y, tree.left.x, tree.left.y);
	    drawTree(tree.left);
	}
	if (tree.right != null) {
	    gl.objectColor = normalColor;
	    edge(tree.x, tree.y, tree.right.x, tree.right.y);
	    drawTree(tree.right);
	}
    }

    function findNode(tree, pt) {
	if (tree == null)
	    return null;
	var dx = pt.x - tree.x;
	var dy = pt.y - tree.y;
	if (dx*dx + dy*dy <= nodeRadius*nodeRadius)
	    return tree;
	var node = findNode(tree.left, pt);
	if (node) return node;
	return findNode(tree.right, pt);
    }

    function display() {
	frame = 0;  // clear pending animation frame request
	
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	
	if (treeModified) {
	    var treeExtent = setNodePositions(tree);
	    treeModified = false;
	    var aspect = canvas.width / canvas.height;
	    var dx = treeExtent.maxx - treeExtent.minx + 2*boundary;
	    var dy = treeExtent.maxy - treeExtent.miny + 2*boundary;
	    if (dx < 16) dx = 16;
	    if (dy < 4) dy = 4;
	    viewrect.width = dx;
	    viewrect.height = dx/aspect;
	    if (viewrect.height < dy) {
		viewrect.height = dy;
		viewrect.width = aspect*dy;
	    }
	    viewrect.x0 = treeExtent.minx - boundary;
	    viewrect.y0 = treeExtent.miny - boundary;
	    viewrect.x1 = viewrect.x0 + viewrect.width;
	    viewrect.y1 = viewrect.y0 + viewrect.height;
	    //
	    // Origin in upper left. Positive y-axis points downward.
	    //
	    gl.Projection.identity().ortho(viewrect.x0, viewrect.x1,
					   viewrect.y1, viewrect.y0,
					   -1, 1);
	    gl.ModelView.identity();
	}
	
	gl.objectColor = [1, 1, 0];
	drawTree(tree);
	
	gl.flush();
    }

    my.display = display;

    return my;
})();
