/*
 * The JS is not "robust" and non-obfuscated :-)
 */

var start = 0;



var GC = {

  /* default message */

  /* Stores the name of the dataset */
  datakey : "csxml" , 

  showState : "topic",

  /* The function that should be called first , load the database 
   * and renders the the root node i.e. node 0 
   */

  load : function() {
    var URL = document.URL;
    var tmp = URL.split("&");
    if (tmp.length > 1)
      if (tmp[1].split("=")[0] = "GC_NODE")
        start = tmp[1].split("=")[1];
    if (start != 0)
      GC.Node.search_word(start);
//    GC.Node.search_author("yiming");
  },

  /*********************************************************************
   * Holds the hierarchy of the given dataset. It is loaded when calling
   * calling the GC.load function. It stays until load is called again.
   **********************************************************************/


  Hierarchy : (function(){
    var Hierarchy = new Object();

    Hierarchy.data = null;
    Hierarchy.parent = null;

    /* Sets the Hierarchy information to match the input data */

    Hierarchy.set_data = function (_data)  {
      Hierarchy.data = _data;
      Hierarchy.parent = new Object();

      for ( var key in _data ) {
	       var p = key;
	       for ( var i = 0; i < _data[key].length; ++i )
	       Hierarchy.parent[ _data[key][i] ] = p;
      } 
    }

    /* Return true if the given node is a leaf-node */

    Hierarchy.is_leaf = function (n) {
      return Hierarchy.data[n] == undefined;
    }

    /* Returns parent of given node [-1 for root node] */

    Hierarchy.get_parent = function (n) {
      if ( n == 0 ) return -1;
      return Hierarchy.parent[n];
    }

    /* On receiving hierarchy data - set it and load the root node */

    Hierarchy.on_load = function (s) {
      Hierarchy.set_data( JSON.parse(s) ); 
    }

    /* Load the hierarchy data, call 'on_load' once data is received */

    Hierarchy.load = function () {
      GC.GetValueFromServer({type:"hierarchy"} , this.on_load );
    }
    return Hierarchy;
  }()) ,


  /**********************************************************************
   * Format of AJAX request to server .
   * value = {type: "hierarchy"}  
   *         | 
   *         {type: "content" | "children", 
   *          node: <node-id>}
   **********************************************************************/


  FormRequest : function ( value ) {
    var loc = "/GC";
    var req = loc + "?GC_DATASET=" + this.datakey;
    if ( value.type == "hierarchy" )
      req += "&GC_REQ=hierarchy";
    else if ( value.type == "content" )
      req += "&GC_REQ=content&GC_NODE=" + value.node;
    else if ( value.type == "children" )
      req += "&GC_REQ=children&GC_NODE=" + value.node;
    else if ( value.type == "timeLine" )
      req += "&GC_REQ=timeLine&GC_NODE=" + value.node;
    else if ( value.type == "searchNode")
      req += "&GC_REQ=searchNode&GC_NODE=" + value.node;
    else if ( value.type == 'buildsubtree')
      req += "&GC_REQ=buildsubtree&GC_NODE=" + value.node;
    else if ( value.type == 'buildsubtreeoftwoword')
      req += "&GC_REQ=buildsubtreeoftwoword&GC_NODEA=" + value.nodeA +"&GC_NODEB=" +value.nodeB;
    else if ( value.type == 'changeTreeNode')
      req += "&GC_REQ=changeTreeNode&GC_NODE=" + value.node;
    else if ( value.type == 'TimeSeriesTree')
      req += "&GC_REQ=TimeSeriesTree&GC_NODE=" + value.node
          + "&FY=" + value.fy
          + "&BY=" + value.by
          + "&NN=" + value.nn;
    else if ( value.type == 'TimeChange')
      req += "&GC_REQ=TimeChange&GC_NODE=" + value.node;
    else if ( value.type == 'AuthorGraph')
      req += "&GC_REQ=AuthorTree&GC_NODE=" + value.node
          + "&SY=" + value.sy
          + "&EY=" + value.ey
          + "&NL=" + value.nl
          + "&EL=" + value.el;
    return req;
  } , 



  /**********************************************************************
   * Send the AJAX request to server and call 'func' when data is recieved
   **********************************************************************/


  GetValueFromServer : function ( value , func , arg ) {
    var url = GC.FormRequest(value);
    /* If you are old IE 5,6,7 - Please die ! , dont use the web */
    var xm = new XMLHttpRequest();
    xm.onreadystatechange = function () {
      if ( xm.readyState == 4 && xm.status == 200 )
	func ( xm.responseText , arg );
    }
    xm.open('get' , url , true );
    xm.send();
  } ,

  /* Holds all the information of the current node being displayed */

  Node : (function(){
    var node = null;
    var year = 1994;
    var ws = null;
    var key = null;
    var relateSet = null;
    var addition_edge = null;
    var author = "hartel";
    Node.showWord = function(s)
    {
      var data = JSON.parse(Node.ws[s]);
      Node.graphics.render_wordseries(data);
    }
    Node.load = function (n) {
      var ha = document.getElementById("hi-super");
      ha.href = "http://bonda.lti.cs.cmu.edu:8003/gc.html&GC_NODE=" + n;
      ha.text = "See_Hierarchy";
      var tr = document.getElementById("tr-super");
      tr.href = "http://bonda.lti.cs.cmu.edu:8003/compare.html&GC_NODEA=" + n;
      tr.text = "Draw_In_Tree";
    }
    Node.topic_search = function(){
      GC.showState = "topic";
      var s = document.getElementById("search-word").value;
      Node.search_word(s);
    }
    Node.author_search = function(){
      GC.showState = "author";
      Node.author = document.getElementById("search-author").value;
      Node.sy = document.getElementById("search-start-year").value;
      Node.ey = document.getElementById("search-end-year").value;
      Node.nl = document.getElementById("search-author-node-number").value;
      Node.el = document.getElementById("search-author-edge-number").value;
      Node.search_author();
    }
    Node.search_word = function(s){
      GC.GetValueFromServer({type:"searchNode", node:s}, Node.search_node);
    }   
    Node.search_node = function(s){
      var data = JSON.parse(s);
      var search_node = data.result;
      Node.key = search_node;
      Node.year = data.year;
      Node.load(search_node);
      var v = document.getElementById("search-year").value;
      if (v.length > 0)
        Node.year = v;
      Node.forward = document.getElementById("search-forward-year").value;
      Node.backward = document.getElementById("search-backward-year").value;
      Node.node_number = document.getElementById("search-node-number").value;
      Node.get_tree();
    }

    Node.search_author = function()
    {
      Node.get_tree();
    }
    Node.get_tree = function()
    {
      if (GC.showState == "topic")
        GC.GetValueFromServer({type:"TimeSeriesTree",node:Node.key + "_" + Node.year,
          fy:Node.forward, 
          by:Node.backward, 
          nn: Node.node_number} , 
          Node.on_load_time_tree)
      if (GC.showState == "author")
        GC.GetValueFromServer({type:"AuthorGraph", node:Node.author,
          sy:Node.sy,
          ey:Node.ey,
          nl:Node.nl,
          el:Node.el}, 
          Node.on_load_time_tree);
    }

    Node.on_load_time_tree = function(s)
    {
      var tmp = JSON.parse(s);
      Node.time_tree = JSON.parse(tmp.tree);
      var data6 = JSON.parse(tmp.relate);
      Node.addition_edge = JSON.parse(tmp.addition_edge);
      Node.relateSet = new Array();
      if (data6.length > 0)
      {
        for (var i = 0; i < Math.min(4,data.length); i++)      
        {
          Node.relateSet[i] = data6[i];
          Node.relateSet[i].index = i;
        }
      }
      Node.graphics.render_tree(Node.time_tree);
    }

    Node.updateAll = function(a, b)
    {
      Node.key = a;
      Node.year = b;
      Node.get_tree();
      Node.load(a);
    }
    Node.graphics = (function(){

      var gx = new Object();

      /* Setup the d3.js parameters and data */

      gx.d3data = null;
      var tw = 400;
      var th = 200; 
      var padding = 50;

      gx.timedata = [];
      gx.timedatar0 = [];
      gx.timedatarp = [];
      gx.timedataws = [];

      gx.xMarks = [];
      gx.xMarksws = [];
      gx.grow_rate = null;
      gx.format = d3.format(",d");

      /* Define the circle-circle pack layout */

      gx.pack = d3.layout.pack()
	       .size([ gx.diameter-4 , gx.diameter-4 ])
	       .padding(5)
	       .value(function(d) { return d.size; });
      gx.urladd = null;   
      /* SVG Container for all the display elements */

      gx.container = null;

      gx.treesvg = null;
      gx.tree = null;
      gx.diagonal = null;
      gx.treeData = null;
      var wmargin = 70;
      var hmargin = 70;
      gx.root = null;
      gx.nodes = null;
      gx.node = null;
      gx.nodeEnter = null;
      gx.nodeUpdate = null;
      gx.link = null;
      gx.cnt = null;
      gx.root = null;
      gx.treetext = null;
      gx.relateNode = null;
      gx.relateNodeu = null;
      gx.nodesmap = null;
      /* Add a svg element to the left-page. Well, you can put this in the html
       * as well. Add 'filters' to the svg object. Currently the only filter is
       * the 'shadow' filter which appears as a 'hover' on the circles.
       */

      (function setup_graphics(){
        //initialize the tree
        var w = document.documentElement.clientWidth*0.6;
        var h = document.documentElement.clientHeight*1.5;
        gx.tree = d3.layout.tree()
        .size([w-2*wmargin, h-2*hmargin]);

        gx.diagonal = d3.svg.diagonal()
          .projection(function(d) { return [d.x, d.y]; });

        gx.treetext = d3.select("#graph-part").append("svg")
        .attr("width", w)
        .attr("height", h);
        gx.treesvg = gx.treetext
        .append("g")
        .attr("transform", "translate(" + wmargin + "," + hmargin + ")");
        var hinter = (h - 2 * hmargin)/11;
        for (var year = 1994; year <= 2004; year ++)
        {
          gx.treetext.append("text")
          .attr("x", w - wmargin/2)
          .attr("y", hmargin + hinter * (year-1994) + hinter/2)
          .attr("text-anchor", "right")  
          .style("font-size", "12px") 
          .text(year.toString());
        }
      }());

      gx.calc_new_coord = function(node, width, hinter, year_cnt)
      {
        var winter = width / 12;
        if (Node.year == node.year)
          winter = width/5;
        if (node.children == undefined)
          return;
        var cnt1 = 0;
        var cnt2 = 0;
        for (var i = 0; i < node.children.length; i++)
        {
          if (node.children[i].mark == 1)
            cnt1 +=1;
          else
            cnt2 +=1;
        }
        if (cnt1 != 0)
        {
          for (var i = 0; i < node.children.length; i++)
            if (node.children[i].mark == 1)
            {
              node.children[i].y = node.y + hinter;
              node.children[i].x = year_cnt[1][node.year] * winter + winter/2;
              gx.calc_new_coord(node.children[i], width, hinter, year_cnt);
              year_cnt[1][node.year] += 1;
            }
        }
        if (cnt2 != 0)
        {
          for (var i = 0; i < node.children.length; i++)
            if (node.children[i].mark == 2)
            {
              node.children[i].y = node.y - hinter;
              node.children[i].x = year_cnt[2][node.year] * winter + winter/2;
              gx.calc_new_coord(node.children[i], width, hinter, year_cnt);
              year_cnt[2][node.year] += 1;
            }
        }
      }
      gx.convert = function(nodes)
      {
        var w = document.documentElement.clientWidth*0.95*0.6 - 2 * wmargin;
        var h = document.documentElement.clientHeight*1.5 - 2 * hmargin;
        var index = parseInt(Node.year) - 1994;
        var rootnode = null;
        for (var i = 0; i < nodes.length; i++)
          if (nodes[i].depth == 0)
            rootnode = nodes[i];
        var hinter = h/11;
        rootnode.x = w/2;
        rootnode.y = hinter * index + hinter/2;
        rootnode.x0 = rootnode.x;
        rootnode.y0 = rootnode.y;
        var year_cnt = new Array();
        year_cnt[1] = new Array();
        year_cnt[2] = new Array();
        for (var i = 1994; i <= 2004; i++)
        {
          year_cnt[1][i.toString()] = 0;
          year_cnt[2][i.toString()] = 0;
        }
        gx.calc_new_coord(rootnode, w, hinter, year_cnt);
      }

      gx.getnodes = function(root)
      {
        var w = document.documentElement.clientWidth*0.95*0.6 - 2 * wmargin;
        var h = document.documentElement.clientHeight*1.5 - 2 * hmargin;
        var hinter = h/11;
        var cnt = new Array();
        var sum = new Array();
        var res = new Array();
        gx.nodesmap = new Object();
        for (var i = 0; i < root.length; i++)
        {
          var year = root[i].year;
          if (sum[year] == undefined)
          {
            cnt[year] = 0;
            sum[year] = 0;
          }
          sum[year] += 1;
        }
        for (var i = 0; i < root.length; i++)
        {
          var node = root[i].nodeId;
          var year = root[i].year;
          var winter = w/sum[year];
          var tmp = new Object;
          tmp.y = (parseInt(year) - 1994) * hinter + hinter / 2;
          tmp.x = cnt[year] * winter + winter / 2;
          tmp.node = node;
          tmp.year = year;
          tmp.desc = root[i].desc;
          tmp.keyw = root[i].keyw;
          tmp.diff = root[i].diff;
          gx.nodesmap[root[i].node] = res.length;
          cnt[year] += 1;
          res.push(tmp);
        }
        return res;
      }

      gx.getlinks = function()
      {
        var edge = Node.addition_edge;
        var nodes = gx.nodes;
        var res = new Array();
        for (var i = 0; i < edge.length; i++)
        {
          var tmp = new Object();
          tmp.source = gx.nodes[gx.nodesmap[edge[i].source]];
          tmp.target = gx.nodes[gx.nodesmap[edge[i].target]];
          var yearA = tmp.source.year;
          var yearB = tmp.target.year;
          if (parseInt(yearA) < parseInt(yearB))
            gx.nodes[gx.nodesmap[edge[i].source]].children = 1;
          else
            gx.nodes[gx.nodesmap[edge[i].target]].children = 1;
          tmp.rank = edge[i].rank;
          tmp.idadd = 1;
          res.push(tmp);
        }
        return res;
      }

      gx.render_tree = function(root)
      {
        gx.root = root;
        var w = document.documentElement.clientWidth*0.95*0.6 - 2 *wmargin;
        var h = document.documentElement.clientHeight*1.5- 2 * hmargin;
        var duration = 750;
        gx.cnt = 0;
        gx.treesvg.selectAll("*").remove();
        root.x0 = 0;
        root.y0 = 0;
        if (GC.showState == "topic")
        {
/*          gx.nodes = gx.tree.nodes(gx.root).reverse();
          gx.convert(gx.nodes);
          //insert relate topic
          var winter = w / 5;
          for (var i = 0; i < Node.relateSet.length; i++)
          {
            if (i < 2) Node.relateSet[i].x = root.x0 - (2-i) * winter;
            else Node.relateSet[i].x = root.x0 + (4-i) * winter;
            Node.relateSet[i].y = root.y0;
            gx.nodes.push(Node.relateSet[i]);
          }
          gx.links = gx.tree.links(gx.nodes);*/
          gx.nodes = gx.getnodes(root);
          gx.links = gx.getlinks();
        }
        if (GC.showState == "author")
        {
          gx.nodes = gx.getnodes(root);
          gx.links = gx.getlinks();
        }
        gx.node = gx.treesvg.selectAll("g.node")
                  .data(gx.nodes, function(d){return d.id || (d.id = ++gx.cnt);});
        gx.nodeEnter = gx.node.enter().append("g")
                      .attr("class","node")
                      .attr("transform", function(d) {return "translate(" + root.x0 + "," + root.y0 + ")";})
                      .on("click", function(d){
                        GC.Node.updateAll(d.node, d.year)
                      });
        gx.nodeEnter.append("circle")
        .attr("r", function(d){
          if (d.mark == 0)
            return 15;
          return 10;
        })
        .style("fill", function(d){
          return "rgb( " + Math.round(255.0 * d.diff) 
          + "," + Math.round(255.0 * (1.0-d.diff)) +  ", 0)";

        })
        gx.nodeEnter
        .append("title").text(function(d){ return d.desc.join(", ")});
        gx.nodeEnter.append("text")
        .attr("y", function(d){ 
          if (GC.showState == "author")
            return 30;
          return d.children ? -50:30;
        }
        )
        .attr("dy",".35em")
        .attr("text-anchor", function(d){return "middle"})
        .text(function(d){return d.keyw.join(' ')})
        .style("fill-opacity",1e-6);  

        var insertLinebreaks = function (d) {
          var el = d3.select(this);
          var words = d.keyw;
          el.text('');

          for (var i = 0; i < words.length; i++) {
              var tspan = el.append('tspan').text(words[i]);
              if (i > 0)
                  tspan.attr('x', 0).attr('dy', '15');
          }
        };

        gx.nodeEnter.selectAll("text").each(insertLinebreaks);
        gx.nodeEnter
        .append("title").text(function(d){ return d.desc.join(", ")});    
        gx.nodeEnter.append("text")
        .attr("y", -20)
        .attr("dy",".35em")
        .attr("text-anchor", function(d){return "middle"})
        .text(function(d){return d.desc[0]})
        .style("fill-opacity",1e-6);

        gx.nodeUpdate = gx.node.transition()
                        .duration(duration)
                        .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")";});
        gx.nodeUpdate.select("text")
        .style("fill-opacity", 1);
        gx.link = gx.treesvg.selectAll("path.link")
        .data(gx.links);
        gx.link.enter()
        .insert("path", "g")
        .attr("class", "link")
        .attr("d", function(d){
          var o = {x: root.x0, y: root.y0};
          return gx.diagonal({source: o, target: o});
        })
        .on("click", function(d) { 
          window.open("http://bonda.lti.cs.cmu.edu:8007/compare.html&GC_NODEA="
           + d.source.node + "&GC_NODEB=" + d.target.node); 
        })
        .attr("stroke-width", function(d){
          var base = 15;
          if (GC.showState == "topic")
            base = 10;
          if (d.isadd == 0)
              return base * d.target.rank;
          else
            return base * d.rank;
        });
    /*
        .attr("xlink:href", function(d){
          return "http://bonda.lti.cs.cmu.edu:8003/compare.html&GC_NODEA="
           + d.source.nodeId + "&GC_NODEB=" + d.target.nodeIDd;
        });*/
        gx.link
        .transition()
        .duration(duration)
        .attr("d", gx.diagonal);
      }
      /* End of graphics object */
      return gx;
    }());

    /* End of Node object */
    return Node;
  }()) , 


  /* **********************************************************************
   * General set of Utility function.
   *       1. Camel case conversion
   *       2. Hook keys to a function
   * **********************************************************************/


  utils : (function(){
    var utils = new Object();

    utils.keytofunc = {};

    utils.camel_case = function (s) {
      return s.charAt(0).toUpperCase() + s.slice(1);
    };

    /* Helper functions to hook keys to function */

    utils.hookescape = function (func) {
      utils.keytofunc[27] = func;
      
    };

    utils.hooknext = function (func) {
      utils.keytofunc[39] = func;
    }

    utils.hookprev = function (func) {
      utils.keytofunc[37] = func;
    }

    utils.unhookall = function () {
      utils.keytofunc = {};
    }

    /* Initialize (whicher does not depend on GC) */
    window.onkeypress = function (event) {
      var e = event.keyCode || event.which;
      if ( utils.keytofunc[e] ) utils.keytofunc[e](e);
    }

    document.onkeydown = function (event) {
      var e = event.keyCode || event.which;
      if ( utils.keytofunc[e] ) utils.keytofunc[e](e);
    }

    utils.hookescape( function(){ GC.Node.load_parent();} );

    return utils;
  }())
};



