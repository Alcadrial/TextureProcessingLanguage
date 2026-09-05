
//create a constant variable that will later resolved to an image
const icon = "icon.png";

//create a new variable and initialize as an empty image of size 32px*32px
var image = empty{32,32};

//calculate a new image and save it to the var image, here the var "icon" is resolved
//to the real image and then blended with the var "image"
//Expressions evaluation is done left to right without precedence
//so (3 * pi + 8) = (3 * (pi + 8))
image = image ** icon;
image = image ** (icon @ (random() * 3 * pi / 8));
image = image ** (icon !@ (random() * 3 * pi / 8));

//return the result, the image is written to the file named "out.png"
return image;