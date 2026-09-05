# TextureProcessingLanguage

A DSL for manipulate images.

## Types

The language accepts the following types:

- Number
- Boolean
- String
- Image
- Empty

The type String is used only as parameter or to locate an image.

Any variable of type String may be used in place of Image, in that case the string is
resolved to the FileSystem and the content of it's file is used.

Empty is a special type that represent an image with zero dimensions, can be used only with the Range and Resize operators and a value of this type can only be references using the built-in variable "empty".

Any variable is typed at initialization (may occur after declaration if using "var") and its type is fixed for its entire life-time, the only exceptions are Strings, Empties and Image, the first can change type to Image and the other two can change type to each other (conceptually a String may be resolved to an Image, an Empty is just a restricted Image)

## Language Features

The language support the following features:

- Var and Const declaration
- Auto typed variables at declaration
- Auto assignment operators (+=, -=, ...)
- IfElse
- While
- Functions
- Closures
- Print of strings and variables
- Stacktrace print
- Lazy resolution of images

## Operators

All classics arithmetic, logic and relational operators and the following image specific operators are supported.

### Range operator

`image[x0,y0->x1,y1,color]`

Can be used in expression and in assignment.<br>
If used as an expression extract a region of the image for subsequent operations,
replacing pixels outside the image bounds with the given color (or transparent black if not specified).<br>
If used as assignment specify the region that will be replaced, if the range is outside the
image bounds then the missing pixels are added with the given color (or transparent black if not specified).

### Resize operator
`image{w,h,kernel}`<br>
`empty{w,h,color}`

color is optional (defaults to fully transparent black)

### Rotate operator

`image @ angle`<br>
`image !@ angle`

Rotate the image counter clockwise around the bottom right corner by the given angle,
if "!@" is used then the rotation is clockwise. An empty black background is added where
missing.

### Concat operator

`image0 cop image1`

where cop is one of "|>"(right), "|<"(left), "|^"(up), "|v"(down),
"|<v"(left down), "|<^"(left up), "|>^"(right up), "|>v"(right down)

Creates a new image by putting image1 next to image0 in the direction defined by
the specific operator. The result is filled with an empty black background and then the images are drawn.<br>
Example: i0 |< i1 creates an image where i1 is to the left and i0 is to the right

### Blend operator

`image0 ** image1`

Order is important, image1 is blended into image0, in case of opaque images, image1
is drawn over image1

### Flop operator

`|image`

Reflect the image by the left border

### Sharpen operator

`#image`

Makes the edge of the image sharper

## Built-in

### Variables

- empty:

  An image with zero size that cannot be created or modified, is used to create fixed color images of any size

### Functions

- width(image): Returns the width of the given image
- height(image): Returns the height of the given image
- random(): Returns a pseudorandomly generated numeber between 0 and 2^32 exclusive

## Examples

In [this](examples/simple/) folder there are some example files named as "exampleN.tpl" where N is the id of the example, they can be easly run specifying "example=N" as program argument for the program.

### [Example 0](examples/simple/example0.tpl)

This example creates an image of 2 gears of different sizes inside a colored frame.
It uses custom functions, if, return, concat operators, empty, the resize operator and blending

### [Example 1](examples/simple/example1.tpl)

This example create a random image from a TileSet.
It uses while loops and the range operator

### Example2

TODO

## Tests

In [this](examples/simple/) folder there are some test files named as "testN.tpl" where N is the id of the test, they can be easly run specifying "test=N" as program argument for the program.
