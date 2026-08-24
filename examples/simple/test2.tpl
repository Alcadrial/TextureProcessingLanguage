

var icon = "icon2.png";

rotate(image, angle) {
    return image @ angle;
}
testPredicate(i) {
    var t = ((i % 4) == 2) && ((i % 6) == 2);
    if (t) {
        icon *= icon;
        print "icon %s"(icon);
    }
    return t;
}

var mask = {
    return "icon30.png";
};
var newIcon = icon;
var i = 0;
while (i < 20) {
    newIcon = { if (testPredicate(i)) return rotate(newIcon, i / 1.33); return newIcon; };

    i += 1;
    print "newIcon: %s, index: %s, action: %s"(newIcon, i, { if (testPredicate(i)) return "rotate"; return "idle"; });
}

return icon;