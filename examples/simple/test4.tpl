
const ce = empty;
var e = empty;
print "e = %s"(e);
e = e{10,10, "#d3ad12"};
print "e{10,10} = %s"(e);
e[5,5->15,15, "#12b609"] = empty[10,10->32,32, "#c81b1b"];
print "empty[10,10->32,32] = %s"(e);
var e0 = empty;
e0[5,5->15,15, "#12b609"] = empty[10,10->32,32, "#c81b1b"];
var e1 = empty;
e1[-5,-5->15,15, "#12b609"] = empty[10,10->32,32, "#c81b1b"];

return e |> e0 |> e1;
