

var icon = "icon2.png";

rotate(image, angle) {
    return image @ angle;
}

var mask = {
    return "icon30.png";
};
var newIcon = icon;
var i = 0;
while (i < 4) {
    newIcon = rotate(newIcon, i / 10);
   // if (icon ~ "2-Gray") break;
    i += 1;
    print "newIcon %s, index %s"(newIcon, i);
}

return newIcon;