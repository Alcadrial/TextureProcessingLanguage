
var m0 = ((#(|"icon.png") ** "mask1.png") |>v "icon6.png"[2,6->8,14]) ** "mask2.png"{40, 40};
var m1 = ("icon28.png" ** "mask0.png")[1,1->15,16/2];

var e = empty;
print "e = %s"(e);
e = e{10,10};
print "e{10,10} = %s"(e);
e = empty[10,10->32,32];
print "empty[10,10->32,32] = %s"(e);

return (m0 |> m1){80, 50, "cubic"};
