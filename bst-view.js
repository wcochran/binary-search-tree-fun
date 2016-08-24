//
// CHeck out the following for debugging under iOS on OS X Safari.
// http://apple.stackexchange.com/questions/162051/why-doesnt-mobile-safari-have-a-javascript-console
//

var bstView = (function() {
    var my = {};       // returned object holding module methods

    var tree = null;   // Binary Search Tree (see setTree()) below)
    var treeModified;  // true => recompute tree layout

    var canvas;
    var gl;
    var program;

    var viewrect = {};   // 2D viewable region (set lazily in display())
    var oldViewrect = null;  // old viewable region (for animation)
    var selectedNodes = [];

    var frame = 0;             // requested frame
    var animating = false;     // currently animating?
    var animationStart = null; // time stamp (milliseconds) of start of animation
    var animationLength;       // length of animation (milliseconds)

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
    var dragginfNodeOriginalPostion;

    function handleMouseOrTouchDown(pos) {
	if (keySelector.didTapForward(pos)) {
	    keySelector.key = (keySelector.key + 1) % 100;
	    if (frame == 0) frame = requestAnimationFrame(display);
            return;
	}

	if (keySelector.didTapFastForward(pos)) {
	    keySelector.key = (keySelector.key + 10) % 100;
	    if (frame == 0) frame = requestAnimationFrame(display);
            return;
	}

	if (keySelector.didTapReverse(pos)) {
	    keySelector.key = (keySelector.key -1 + 100) % 100;
	    if (frame == 0) frame = requestAnimationFrame(display);
            return;
	}

	if (keySelector.didTapFastReverse(pos)) {
	    keySelector.key = (keySelector.key - 10 + 100) % 100;
	    if (frame == 0) frame = requestAnimationFrame(display);
            return;
	}

	if (keySelector.didTapKey(pos)) {
            var key = keySelector.key;
	    if (!find(tree, key)) {
		tree = insert(tree, key);
		animating = true;
		animationLength = 0.3*1000;
		treeModified = true;
		if (frame == 0) frame = requestAnimationFrame(display);
	    }
            return;
	}

	var vpos = canvasToViewRect(pos);
	var node = findNode(tree, vpos);
	if (node) {
            draggingNode = node;
	    draggingNodeOriginalPosition = {
		x : node.x,
		y : node.y
	    };
        }
    }

    function handleMouseOrTouchMove(pos) {
	var vpos = canvasToViewRect(pos);
	draggingNode.x = vpos.x;
	draggingNode.y = vpos.y;
	if (frame == 0) {
	    frame = requestAnimationFrame(display);
	}
    }

    function handleMouseOrTouchUp(pos) {
	var vpos = canvasToViewRect(pos);
	var parentNode = findNode(tree, vpos);

	var rotated = false;
	if (parentNode) {
	    if (parentNode.left === draggingNode) {
		tree = rotateRight(tree, parentNode);
		rotated = true;
	    } else if (parentNode.right === draggingNode) {
		tree = rotateLeft(tree, parentNode);
		rotated = true;
	    }
	}
	
	if (rotated) {
	    animating = true;
	    animationLength = 0.3*1000;
	    treeModified = true;
	} else {
	    // later : animate node back to original position
	    draggingNode.x = draggingNodeOriginalPosition.x;
	    draggingNode.y = draggingNodeOriginalPosition.y;
	}
	if (frame == 0) {
	    frame = requestAnimationFrame(display);
	}
	draggingNode = null;
	return;
	/* XXXX selecting a node
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
	*/
    }
    
    function mouseDown(event) {
	if (animating)
	    return;
	var pos = getMousePos(canvas, event);
	handleMouseOrTouchDown(pos);
    }

    function mouseMove(event) {
	if (draggingNode) {
	    var pos = getMousePos(canvas, event);
	    handleMouseOrTouchMove(pos);
	}
    }

    function mouseOut(event) {
	if (draggingNode) {
	    draggingNode.x = draggingNodeOriginalPosition.x;
	    draggingNode.y = draggingNodeOriginalPosition.y;
	    draggingNode = false;
	    if (frame == 0) frame = requestAnimationFrame(display);
	}
    }

    function mouseUp(event) {
	if (draggingNode) {
	    var pos = getMousePos(canvas, event);
	    handleMouseOrTouchUp(pos);
	}
    }

    function getTouchPos(canvas, touch) {
	var rect = canvas.getBoundingClientRect();
	return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
	};
    }

    function touchStart(event) {
	event.preventDefault();
	if (animating)
	    return;
	var touch = event.changedTouches[0];
	var pos = getTouchPos(canvas, touch);
	handleMouseOrTouchDown(pos);
    }

    function touchMove(event) {
	event.preventDefault();
	if (draggingNode) {
	    var touch = event.changedTouches[0];
	    var pos = getTouchPos(canvas, touch);
	    handleMouseOrTouchMove(pos);
	}
    }

    function touchEnd(event) {
	event.preventDefault();
	if (draggingNode) {
	    var touch = event.changedTouches[0];
	    var pos = getTouchPos(canvas, touch);
	    handleMouseOrTouchUp(pos);
	}
    }

    function touchCancel(event) {
	event.preventDefault();
	if (draggingNode) {
	    draggingNode.x = draggingNodeOriginalPosition.x;
	    draggingNode.y = draggingNodeOriginalPosition.y;
	    draggingNode = false;
	    if (frame == 0) frame = requestAnimationFrame(display);
	}
    }

    my.init = function(canvas_) {
        canvas = canvas_;
	gl = null;
	try {
            // XXX gl = canvas.getContext("webgl");
            gl = WebGLDebugUtils.makeDebugContext(canvas.getContext("webgl"));
	} catch(e) {gl = null;}
	if (gl == null) {
            return false;
	}

	canvas.addEventListener("mousedown", mouseDown, false);
	canvas.addEventListener("mousemove", mouseMove, false);
	canvas.addEventListener("mouseout", mouseOut, false);
	canvas.addEventListener("mouseup", mouseUp, false);

	canvas.addEventListener("touchstart", touchStart, false);
	canvas.addEventListener("touchmove", touchMove, false);
	canvas.addEventListener("touchend", touchEnd, false);
	canvas.addEventListener("touchcancel", touchCancel, false);

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

	gl.viewport(0,0, canvas.width, canvas.height);

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
    var footer = 1.4;  // room for controls at bottom of canvas

    function edge(x0,y0, x1,y1) {
	var dx = x1 - x0, dy = y1 - y0;
	var len = Math.sqrt(dx*dx + dy*dy);
	var u = dx/len, v = dy/len;
	lineSegment.draw(x0 + nodeRadius*u, y0 + nodeRadius*v,
			 x1 - nodeRadius*u, y1 - nodeRadius*v);
    }

    var selectedColor = [1, 0, 0];
    var normalColor = [1, 1, 0];

    function lerp(t, a, b) {
	return (b - a)*t + a;
    }

    function drawTree(tree, timeFraction) {
	var index = selectedNodes.findIndex(
	    function(elem, i, a){
		return elem.key == tree.key;
	    });
	gl.objectColor = (index >= 0) ? selectedColor : normalColor;
	var x = (timeFraction === undefined) ? tree.x : lerp(timeFraction, tree.oldx, tree.x);
	var y = (timeFraction === undefined) ? tree.y : lerp(timeFraction, tree.oldy, tree.y);
	digit.drawNumber(x, y, textHeight, tree.key);
	circle.draw(x, y, nodeRadius);
	if (tree.left != null) {
	    gl.objectColor = normalColor;
	    var leftx = (timeFraction === undefined) ? tree.left.x : lerp(timeFraction, tree.left.oldx, tree.left.x);
	    var lefty = (timeFraction === undefined) ? tree.left.y : lerp(timeFraction, tree.left.oldy, tree.left.y);
	    edge(x, y, leftx, lefty);
	    drawTree(tree.left, timeFraction);
	}
	if (tree.right != null) {
	    gl.objectColor = normalColor;
	    var rightx = (timeFraction === undefined) ? tree.right.x : lerp(timeFraction, tree.right.oldx, tree.right.x);
	    var righty = (timeFraction === undefined) ? tree.right.y : lerp(timeFraction, tree.right.oldy, tree.right.y);
	    edge(x, y, rightx, righty);
	    drawTree(tree.right, timeFraction);
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

    var rightPointer = {
	VBO : -1,
	loadVBO : function() {
	    var s = Math.sqrt(2)/2;
	    var verts = new Float32Array([
		    -s, -s,
		    +1, 0,
		    -s, +s]);
	    this.VBO = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.VBO);
            gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
	},
	draw : function(x, y, xradius, yradius) {
            if (this.VBO < 0)
		this.loadVBO();
	    gl.matrixStack.push(gl.ModelView);
	    gl.ModelView.translate(x,y,0).scale(xradius, yradius, 1);
            loadUniforms();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.VBO);
            gl.enableVertexAttribArray(program.vertexPosition);
            gl.vertexAttribPointer(program.vertexPosition,
                                   2, gl.FLOAT, false, 0, 0);
            // XXX gl.drawArrays(gl.LINE_LOOP, 0, 3);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
	    gl.matrixStack.pop(gl.ModelView);
	}
    }

    function KeySelector() {
	this.key = 0;
	this.x = this.y = 0;
	this.radius = 24; // pixels (1:1 with canvas)
	this.textHeight = 13;
	this.forwardCenterX = 2*this.radius;
	this.fastForwardCenterX = 4*this.radius;
	this.reverseCenterX = -2*this.radius;
	this.fastReverseCenterX = -4*this.radius;
    }

    KeySelector.prototype.draw = function() {
	gl.objectColor = normalColor;
	gl.matrixStack.push(gl.ModelView);
	gl.matrixStack.push(gl.Projection);
	gl.Projection.identity().ortho(0, canvas.width,
				       canvas.height, 0,
				       -1, 1);
	gl.ModelView.identity();
	var x = canvas.width/2;
	var y = canvas.height - (this.radius + 5);
	this.x = x;
	this.y = y;
	if (!find(tree, this.key))
	    gl.objectColor = [0, 1, 0];
	else
	    gl.objectColor = [0.4, 0.4, 0.4];
	digit.drawNumber(x, y, this.textHeight, this.key);
	gl.objectColor = [0, 1, 0];
	circle.draw(x, y, this.radius);
	var s = 0.7;
	var r = s*this.radius;
	rightPointer.draw(x + this.forwardCenterX, y, r, r);
	var d = 0.5*r;
	rightPointer.draw(x + this.fastForwardCenterX - d, y, r, r);
	rightPointer.draw(x + this.fastForwardCenterX + d, y, r, r);
	rightPointer.draw(x + this.reverseCenterX, y, -r, r); // flip : -x
	rightPointer.draw(x + this.fastReverseCenterX - d, y, -r, r);
	rightPointer.draw(x + this.fastReverseCenterX + d, y, -r, r);
	gl.matrixStack.pop(gl.Projection);
	gl.matrixStack.pop(gl.ModelView);
    }

    KeySelector.prototype.didTapKey = function(pos) {
	var dx = pos.x - this.x;
	var dy = pos.y - this.y;
	return dx*dx + dy*dy <= this.radius*this.radius;
    }

    KeySelector.prototype.didTapForward = function(pos) {
	var dx = pos.x - (this.x + this.forwardCenterX);
	var dy = pos.y - this.y;
	return dx*dx + dy*dy <= this.radius*this.radius;
    }

    KeySelector.prototype.didTapFastForward = function(pos) {
	var dx = pos.x - (this.x + this.fastForwardCenterX);
	var dy = pos.y - this.y;
	return dx*dx + dy*dy <= this.radius*this.radius;
    }

    KeySelector.prototype.didTapReverse = function(pos) {
	var dx = pos.x - (this.x + this.reverseCenterX);
	var dy = pos.y - this.y;
	return dx*dx + dy*dy <= this.radius*this.radius;
    }

    KeySelector.prototype.didTapFastReverse = function(pos) {
	var dx = pos.x - (this.x + this.fastReverseCenterX);
	var dy = pos.y - this.y;
	return dx*dx + dy*dy <= this.radius*this.radius;
    }

    var keySelector = new KeySelector();

    function resizeCanvasIfNeeded() {
	var devPixelRatio = window.devicePixelRatio || 1;
	var displayWidth  = Math.floor(canvas.clientWidth * devPixelRatio);
	var displayHeight = Math.floor(canvas.clientHeight * devPixelRatio);
	if (canvas.width  != displayWidth ||
	    canvas.height != displayHeight) {
	    canvas.width  = displayWidth;
	    canvas.height = displayHeight;
	    gl.viewport(0, 0, canvas.width, canvas.height);
	    treeModified = true;
	}
    }

    function display(timeStamp) {
	frame = 0;  // clear pending animation frame request

	resizeCanvasIfNeeded();
	
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	
	if (treeModified) {
	    var treeExtent = setNodePositions(tree);
	    treeModified = false;
	    aspect = canvas.width / canvas.height;
	    var dx = treeExtent.maxx - treeExtent.minx + 2*boundary;
	    var dy = treeExtent.maxy - treeExtent.miny + 2*boundary + footer;
	    if (dx < 16) dx = 16;
	    if (dy < 4) dy = 4;
	    if (animating) {
		oldViewrect = {};
		oldViewrect.width = viewrect.width;
		oldViewrect.height = viewrect.height;
		oldViewrect.x0 = viewrect.x0;
		oldViewrect.y0 = viewrect.y0;
		oldViewrect.x1 = viewrect.x1;
		oldViewrect.y1 = viewrect.y1;
	    }
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
	    if (!animating) {
		gl.Projection.identity().ortho(viewrect.x0, viewrect.x1,
					       viewrect.y1, viewrect.y0,
					       -1, 1);
		gl.ModelView.identity();
	    }
	}
	
	gl.objectColor = [1, 1, 0];

	if (animating) {
	    if (!animationStart)
		animationStart = timeStamp;
	    var animationFraction = (timeStamp - animationStart)/animationLength;
	    if (animationFraction < 1) {
		gl.Projection.identity().ortho(lerp(animationFraction, oldViewrect.x0, viewrect.x0), 
					       lerp(animationFraction, oldViewrect.x1, viewrect.x1),
					       lerp(animationFraction, oldViewrect.y1, viewrect.y1),
					       lerp(animationFraction, oldViewrect.y0, viewrect.y0),
					       -1, 1);
		gl.ModelView.identity();
		drawTree(tree, animationFraction);
		keySelector.draw();
		if (frame == 0)
		    frame = requestAnimationFrame(display);
	    } else {  // done animating
		animating = false;
		animationStart = null;
		drawTree(tree);
		keySelector.draw();
	    }
	} else {
	    drawTree(tree);
	    keySelector.draw();
	}
	
	gl.flush();
    }

    my.display = display;

    return my;
})();
