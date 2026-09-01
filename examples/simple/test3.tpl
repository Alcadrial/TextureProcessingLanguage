
var m0 = ((#(|"icon.png") ** "mask1.png") |>v "icon6.png"[2,6->8,14]) ** "mask2.png"{40, 40};
var m1 = ("icon28.png" ** "mask0.png")[1,1->15,16/2];

return (m0 |> m1){80, 50, "cubic"};
