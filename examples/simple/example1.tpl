
/*
    Function that returns a new image that is the same of the given one
    with a border of "size" pixels of the given color
*/
addBorder(image, size, color) {
    if (size <= 0) return image;
    return image[-size, -size -> width(image) + size, height(image) + size, color];
}
/*
    Function that returns calculates a new image from the given one by
    adding a border of the given size using 3 colors to create a shade effect
*/
addFrame(image, size, color0, color1, color2) {

    //check parameters
    if (size <= 0) return image;
    if (size == 1) return addBorder(image, 1, color1);
    
    var t = image;
    //add inner border of 1px of color "color2"
    t = addBorder(t, 1, color2);
    //add extra border to match size of color "color1"
    if (size > 2) t = addBorder(t, size - 2, color1);
    //add outer border of 1px color "color0"
    t = addBorder(t, 1, color0);
    //return the image to the callee
    return t;
}

//bind variables to images from the FS, the images must have an empty background, possibly black
const littleGear = "icon28.png";
const bigGear = "icon31.png";

//compose the gears toghether with "littleGear" to the lower left corner and
//"bigGear" to the upper right corner, with an empty black background
var image = (littleGear |>^ empty{24,24}) + (bigGear |<v empty{8,8});

//compute the background of the right size using the built-in functions "width" and "height"
const background = empty{width(image), height(image), "#292929"};
//and add it to the image using the blending operator
image = background ** image;

//add a frame of 8px and return
return addFrame(image, 8, "#ecbb48", "#E6A40E", "#a1740b");