var y_padding = 74
var x_padding = 74

var pages = [];
var docSettings = doc_settings;
var active



doc_settings.default_page_size = new Size(2551/2,3295/2)
doc_settings.default_line_style = "none"
doc_settings.default_bg = "#FFFFFF"
doc_settings.title = "new notes"
doc_settings.current_tool = "pen"
doc_settings.pen_size = 1
doc_settings.pen_color = "#472d3c"
doc_settings.view_center = new Point(0,0)
doc_settings.view_zoom = .5
doc_settings.simplify_paths = true



function make_page(w, h, color, lines, yoffset, old_layer_data) {
	// Create the page data construct object
	var pageData = {
	  page_size: new Size(w,h),
	  page_bg_layer: new Layer(),
	  page_lines_layer: new Layer(),
	  page_layer: new Layer(),
	  page_bg: color,
	  page_lines: lines,
	  page_yoffset: yoffset,
	};

	pageData.page_layer.applyMatrix = true
	pageData.page_lines_layer.applyMatrix = true

	pageData.page_layer.translate(new Point(0, yoffset))
	pageData.page_lines_layer.translate(new Point(0, yoffset))

	if (old_layer_data !== null) {
		pageData.page_layer.importJSON(old_layer_data)
	}
  
	if (pageData.page_lines !== "none") {
	  // TODO: make page_lines_layer contain the lines type requested, using a function to do so
	}
  
	return pageData;
};
  

function update_doc_view() {
	view.center = doc_settings.view_center
	view.zoom = doc_settings.view_zoom
}


// pageData is the data for the page with its layer and other features.
function draw_page(pageData) {
	var topL = new Point(x_padding,pageData.page_yoffset)
	var botR = topL + pageData.page_size
	pageData.page_bg_layer.activate()
	var page_bg = new Path.Rectangle(topL,botR)
	page_bg.fillColor = pageData.page_bg
}


// sets up a single, blank page.

main_api.load_new_doc = function() {
	var firstPage = make_page(doc_settings.default_page_size.width, 
		doc_settings.default_page_size.height,
		doc_settings.default_bg,
		doc_settings.default_line_style,
		y_padding,
		null)

	pages.push(firstPage)


	//draw first page
	draw_page(firstPage)
	doc_settings.view_center = new Point(firstPage.page_size.width/2,(firstPage.page_size.height/2) + y_padding - view.size.height/2)
	doc_settings.view_zoom = 1
	update_doc_view()
};


// page interactions

function getActivePage(point) {
	for (var i = 0; i < pages.length; i++) {
	  var page = pages[i];
	  var topL = new Point(x_padding, page.page_yoffset);
	  var botR = topL + page.page_size;
  
	  if (point.isInside(new Rectangle(topL, botR))) {
		// console.log("Active Page:",page)
		return page;
	  }
	}
	return null; // Return null if no page is found
}

// make a drawing tool
var drawingTool = new Tool();
var currentPath;
var originalPage;

drawingTool.onMouseDown = function(event) {
	console.log('Mouse down at', event.point, 'on page', getActivePage(event.point));
	var activePage = getActivePage(event.point);
	if (activePage) {
		originalPage = activePage; // Save the original page
		activePage.page_layer.activate();
		currentPath = new Path();
		activePage.page_layer.addChild(currentPath);
		currentPath.strokeColor = doc_settings.pen_color;
		currentPath.strokeWidth = doc_settings.pen_size;
		currentPath.strokeCap = 'round'; // Round the ends of the stroke
		currentPath.strokeJoin = 'round'; // Round the corners of the stroke
		currentPath.add(event.point);
		console.log(currentPath)
	}
};

drawingTool.onMouseDrag = function(event) {
	var activePage = getActivePage(event.point);
	if (currentPath && originalPage === activePage) { // Check if the active page has changed
		currentPath.add(event.point);
		console.log("adding point at ",event.point)
	} else if (currentPath) {
		if (docSettings.simplify_paths) {
			currentPath.simplify(); // Simplify the path if the drawing runs off the page
		}
		currentPath = null;
	}
};

drawingTool.onMouseUp = function(event) {
	if (currentPath) {
		if (docSettings.simplify_paths) {
			currentPath.simplify(); // Simplify the path if the drawing runs off the page
		}
		currentPath = null;
	}
	originalPage = null;
};


// make an eraser tool
var eraserTool = new Tool();
var eraserPath;
var originalPage;

function eraseIntersectingPaths() {
	originalPage.page_layer.children.forEach(function(path) {
		if (path !== eraserPath && path.intersects(eraserPath)) {
		if (doc_settings.erase_whole_path) {
			path.remove(); // Remove the entire path
		} else {
			var intersections = eraserPath.getIntersections(path);
			for (var i = intersections.length - 1; i >= 0; i--) {
			var offset = intersections[i].offset;
			path.split(offset); // Split the path at the intersection
			}
			// You may need to identify and remove the central part depending on the exact behavior you want
		}
		}
	});
}

eraserTool.onMouseDown = function(event) {
	var activePage = getActivePage(event.point);
	if (activePage) {
		originalPage = activePage; // Save the original page
		activePage.page_layer.activate();
		eraserPath = new Path();
		eraserPath.strokeColor = '#00000000'; // You can set this to a transparent color if you want
		eraserPath.strokeWidth = doc_settings.pen_size; // Adjust eraser size as needed
		eraserPath.add(event.point);
	}
};

eraserTool.onMouseDrag = function(event) {
	var activePage = getActivePage(event.point);
	if (eraserPath && originalPage === activePage) { // Check if the active page has changed
		eraserPath.add(event.point);
		eraseIntersectingPaths(); // Erase intersecting paths live as the user drags
	} else if (eraserPath) {
		eraseIntersectingPaths(); // Erase intersecting paths if the eraser runs off the page
		eraserPath.remove(); // Remove the eraser path itself
		eraserPath = null;
	}
};

eraserTool.onMouseUp = function(event) {
	if (eraserPath) {
		eraseIntersectingPaths(); // Final erase intersecting paths
		eraserPath.remove(); // Remove the eraser path itself
		eraserPath = null;
	}
	originalPage = null;
};


// panning tool
var panningTool = new Tool();
var lastMousePoint;

panningTool.onMouseDown = function(event) {
  	lastMousePoint = event.point;
};

panningTool.onMouseDrag = function(event) {
	// Calculate how far the mouse has moved since the last drag event
	var offset = lastMousePoint - event.point;

	// Move the view by the calculated offset

	view.scrollBy(offset);
	
    // Update the document settings with the new view center
	docSettings.view_center = view.center;
	// Save the current mouse position for the next drag event
	lastMousePoint = event.point;
};






// tool selector
main_api.setActiveTool = function(toolName) {
	console.log('Activating tool:', toolName);
	switch (toolName) {
		case 'drawing':
			drawingTool.activate();
			break;
		case 'eraser':
			eraserTool.activate();
			break;
		case 'panning':
			panningTool.activate();
			break;
		default:
			console.error('Unknown tool: ' + toolName);
			break;
	}
};
  
main_api.zoom = function(factor) {
	view.zoom *= factor
	doc_settings.view_zoom = view.zoom
}


// signal that we are ready to load
var loadevent = new CustomEvent('paperjs-loaded');
document.dispatchEvent(loadevent);

