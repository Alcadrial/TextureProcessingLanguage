
var littleGear = "icon28.png";
var bigGear = "icon31.png";

addBorder(image, size, color) {
    if (size <= 0) return image;
    return image[-size, -size -> width(image) + size, height(image) + size, color];
}
addFrame(image, size, color0, color1, color2) {

    if (size <= 0) return image;
    if (size == 1) return addBorder(image, 1, color1);
    
    var t = image;
    t = addBorder(t, 1, color2);
    if (size > 2) t = addBorder(t, size - 2, color1);
    t = addBorder(t, 1, color0);
    return t;
}

var image = (littleGear |>^ empty{24,24}) + (bigGear |<v empty{8,8});

var framedImage = addFrame(image, 8, "#ecbb48", "#E6A40E", "#a1740b");

var background = empty{width(framedImage), height(framedImage), "#292929"};

return background ** framedImage;