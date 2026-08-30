# Master household product catalogue — generic product CONCEPTS, not SKUs.
#
# Format per line:  Display Name | alias; alias; alias
# Aliases exist to make search and receipt matching work; they never replace
# the canonical name. No prices, package sizes, UPCs or invented brands.

CATALOGUE = {}

CATALOGUE[("Produce", "Fruit")] = """
Gala Apples | gala
Granny Smith Apples | green apples; tart apples
Honeycrisp Apples | honeycrisp
McIntosh Apples | macintosh
Ambrosia Apples
Red Delicious Apples
Bartlett Pears | pears
Bosc Pears
Anjou Pears
Navel Oranges
Mandarin Oranges | clementines; cuties; tangerines
Grapefruit | pink grapefruit
Blackberries
Cranberries | fresh cranberries
Cherries | sweet cherries
Peaches
Nectarines
Plums
Apricots
Mangoes | mango
Papaya
Honeydew Melon | honeydew
Pomegranate
Passion Fruit
Figs | fresh figs
Medjool Dates | dates
Coconut | whole coconut
Lychee
Persimmon
Rhubarb
Fruit Tray | fruit platter
Fruit Cups | fruit salad cups
Star Fruit | carambola
Guava
"""

CATALOGUE[("Produce", "Vegetables")] = """
Brussels Sprouts
Green Cabbage | cabbage
Red Cabbage | purple cabbage
Napa Cabbage
Bok Choy | pak choi
Leeks
Shallots
Parsnips
Turnip
Rutabaga
Beets | beetroot
Radishes
Butternut Squash
Acorn Squash
Spaghetti Squash
Eggplant | aubergine
Okra
Snap Peas | sugar snap peas
Snow Peas
Edamame | soybeans
Artichoke
Fennel
Fresh Ginger | ginger root
Jalapeno Peppers | jalapenos
Habanero Peppers
Poblano Peppers
Serrano Peppers
Mini Sweet Peppers | sweet peppers; snacking peppers; mini peppers
Orange Bell Pepper | orange pepper; sweet pepper
Roma Tomatoes | plum tomatoes
Beefsteak Tomatoes
Tomatoes on the Vine | vine tomatoes
Heirloom Tomatoes
Baby Carrots
Carrot Sticks
Coleslaw Mix | shredded cabbage
Broccoli Slaw
Cauliflower Rice | riced cauliflower
Broccoli Florets
Cauliflower Florets
Portobello Mushrooms
Cremini Mushrooms | brown mushrooms
Shiitake Mushrooms
White Mushrooms | button mushrooms
Sliced Mushrooms
Celery Hearts
Field Cucumber | cucumber
Pickling Cucumbers
Yellow Squash | summer squash
Sweet Onion | vidalia onion
Green Peas | fresh peas
Peeled Garlic
Red Potatoes
White Potatoes
Butternut Squash Cubes
Stir Fry Vegetables | vegetable stir fry mix
Vegetable Tray | veggie platter
Turnip Greens
"""

CATALOGUE[("Produce", "Leafy Greens")] = """
Red Leaf Lettuce | red leaf
Butter Lettuce | boston lettuce; bibb lettuce
Spring Mix | mixed greens; mesclun
Baby Spinach
Kale | curly kale
Baby Kale
Swiss Chard
Collard Greens
Caesar Salad Kit | caesar kit
Garden Salad Kit | garden salad
Coleslaw | cole slaw
Watercress
Endive
Radicchio
Microgreens
Bean Sprouts | sprouts
Spinach Salad Mix
Chopped Romaine
Salad Blend | salad mix
"""

CATALOGUE[("Produce", "Fresh Herbs")] = """
Fresh Basil | basil
Fresh Cilantro | cilantro; coriander; fresh coriander
Fresh Parsley | parsley
Italian Parsley | flat leaf parsley
Fresh Mint | mint
Fresh Rosemary | rosemary
Fresh Thyme | thyme
Fresh Oregano | oregano
Fresh Sage | sage
Fresh Dill | dill
Fresh Chives | chives
Fresh Tarragon
Lemongrass
Fresh Basil Plant | potted basil
"""

CATALOGUE[("Meat & Seafood", "Beef")] = """
Striploin Steak | strip loin; strip steak
Flank Steak
Skirt Steak
Hanger Steak
T-Bone Steak
Porterhouse Steak
Top Sirloin Steak
Tenderloin Steak | filet mignon
Prime Rib Roast | prime rib
Chuck Roast
Blade Roast
Beef Brisket | brisket
Beef Short Ribs | short ribs
Beef Back Ribs
Medium Ground Beef | medium hamburger; hamburger; minced beef
Regular Ground Beef | regular hamburger; hamburger
Beef Liver
Beef Kabobs | beef skewers
Beef Stir Fry Strips | stir fry beef
Beef Sirloin Tip Roast
Beef Eye of Round
Cross Rib Roast
Beef Shank
Oxtail
Veal Cutlets | veal
Ground Veal
Lamb Chops | lamb
Rack of Lamb
Ground Lamb
Leg of Lamb
Lamb Shoulder
"""

CATALOGUE[("Meat & Seafood", "Poultry")] = """
Chicken Breast | chicken breasts; boneless chicken breast; boneless skinless chicken breast
Bone-In Chicken Breast
Boneless Skinless Chicken Thighs | boneless chicken thighs
Chicken Wings | wings
Chicken Legs | leg quarters
Chicken Tenders | chicken fingers; chicken strips
Ground Chicken
Whole Turkey | turkey
Turkey Breast
Turkey Thighs
Chicken Quarters
Cornish Hen
Duck Breast
Chicken Livers
Chicken Sausage
Turkey Sausage
Chicken Backs
Spatchcock Chicken
Marinated Chicken Breast
Chicken Souvlaki
"""

CATALOGUE[("Meat & Seafood", "Pork")] = """
Pork Loin Roast | pork loin
Pork Shoulder | pork butt; boston butt
Pork Side Ribs | side ribs
Pork Belly
Bacon | strip bacon
Thick Cut Bacon
Back Bacon | peameal bacon; canadian bacon
Ham Steak
Smoked Ham | ham
Pork Cutlets
Pork Schnitzel
Pork Sausage
Pork Ribs
Pulled Pork
Pork Hocks
"""

CATALOGUE[("Meat & Seafood", "Prepared Meat")] = """
Breakfast Sausage
Bratwurst | brats
Chorizo
Hot Dogs | wieners; frankfurters
Sausage Patties
Beef Burgers | hamburger patties; beef patties
Turkey Burgers
Veggie Burgers | plant based burgers
Chicken Burgers
Meat Kebabs | kebabs; skewers
Stuffed Chicken Breast
Marinated Pork
Sausage Coils
Smokies
"""

CATALOGUE[("Meat & Seafood", "Seafood")] = """
Salmon Fillet | salmon
Sockeye Salmon
Coho Salmon
Smoked Salmon | lox
Tilapia Fillet | tilapia
Basa Fillet | basa
Sole Fillet | sole
Halibut Fillet | halibut
Rainbow Trout | trout
Mackerel
Mussels
Clams
Oysters
Scallops
Crab Legs
Lobster Tail
Calamari | squid
Imitation Crab | crab sticks; surimi
Cooked Shrimp
Shrimp Ring | shrimp platter
Fish Fillet Assortment
Arctic Char
Pickerel | walleye
"""

CATALOGUE[("Deli & Prepared", "Deli")] = """
Sliced Ham | shaved ham
Sliced Turkey | turkey breast deli
Sliced Roast Beef
Sliced Chicken
Salami
Pepperoni
Prosciutto
Capicola
Mortadella
Bologna
Pastrami
Corned Beef
Deli Cheese Slices
Charcuterie Tray | meat and cheese tray
Smoked Turkey
Black Forest Ham
Montreal Smoked Meat
"""

CATALOGUE[("Deli & Prepared", "Prepared Meals")] = """
Sushi | sushi tray
Sandwich Platter
Prepared Chicken Wings
Prepared Lasagna
Shepherds Pie | shepherd's pie
Meat Pie | tourtiere
Quiche
Prepared Pasta Salad
Potato Salad
Prepared Coleslaw
Prepared Soup
Prepared Sandwiches
Wrap Platter
Prepared Curry
Prepared Stir Fry
Party Platter
"""

CATALOGUE[("Deli & Prepared", "Dips & Spreads")] = """
Hummus
Roasted Red Pepper Hummus
Tzatziki
Guacamole
Spinach Dip
Onion Dip
Bruschetta Topping
Olive Tapenade
Baba Ganoush
Pesto | basil pesto
Queso Dip
Cheese Dip
Seven Layer Dip
Artichoke Dip
"""

CATALOGUE[("Dairy & Eggs", "Milk")] = """
Whole Milk | homo milk; 3.25% milk
2% Milk | two percent milk
1% Milk | one percent milk
Skim Milk | fat free milk
Chocolate Milk
Strawberry Milk
1% Lactose-Free Milk | lactose free milk
Whole Lactose-Free Milk
Skim Lactose-Free Milk
Buttermilk
Goat Milk
"""

CATALOGUE[("Dairy & Eggs", "Plant-Based Milk")] = """
Almond Milk
Original Almond Milk
Unsweetened Almond Milk
Vanilla Almond Milk
Chocolate Almond Milk
Oat Milk
Vanilla Oat Milk
Barista Oat Milk
Soy Milk
Vanilla Soy Milk
Coconut Milk Beverage | coconut beverage
Cashew Milk
Rice Milk
Pea Milk
Unsweetened Oat Milk
Unsweetened Soy Milk
"""

CATALOGUE[("Dairy & Eggs", "Cheese")] = """
Mozzarella Cheese | mozzarella
Shredded Mozzarella
Shredded Cheddar
Marble Cheese | marble cheddar
Swiss Cheese
Havarti Cheese
Gouda Cheese
Brie Cheese | brie
Camembert Cheese
Feta Cheese | feta
Goat Cheese | chevre
Blue Cheese
Provolone Cheese
Monterey Jack Cheese
Cheese Slices | processed cheese slices
Cheese Strings | string cheese
Mini Cheese Rounds | snacking cheese
Ricotta Cheese | ricotta
Mascarpone Cheese
Halloumi Cheese
Paneer
Grated Parmesan
Nacho Cheese Sauce
Cheese Curds
Old Cheddar Cheese
Mild Cheddar Cheese
Cream Cheese Spread
Boursin Style Cheese | herb cheese spread
Shredded Italian Blend
Cottage Cheese Small Curd
"""

CATALOGUE[("Dairy & Eggs", "Yogurt")] = """
Plain Yogurt
Vanilla Yogurt
Strawberry Yogurt
Fruit Bottom Yogurt
Plain Greek Yogurt
Vanilla Greek Yogurt
Skyr Yogurt | skyr
Kefir
Drinkable Yogurt | yogurt drink
Kids Yogurt Tubes | yogurt tubes
Yogurt Cups
Balkan Yogurt
Coconut Yogurt
Almond Yogurt
High Protein Yogurt
"""

CATALOGUE[("Dairy & Eggs", "Butter & Cream")] = """
Salted Butter
Unsalted Butter
Margarine
Whipping Cream | 35% cream
Half and Half | 10% cream
Coffee Cream | 18% cream
Table Cream
Whipped Cream | aerosol whipped cream
Creme Fraiche
Butter Sticks
Spreadable Butter
Ghee | clarified butter
Non-Dairy Whipped Topping
Sour Cream Light
"""

CATALOGUE[("Dairy & Eggs", "Eggs")] = """
Large Eggs | eggs; dozen eggs
Extra Large Eggs
Free Range Eggs
Organic Eggs
Brown Eggs
White Eggs
Egg Whites | liquid egg whites
Liquid Eggs
Omega-3 Eggs
Hard Boiled Eggs
"""

CATALOGUE[("Bakery", "Bread")] = """
White Bread | bread
Whole Wheat Bread | whole wheat
Multigrain Bread | multi grain bread
Rye Bread
Sourdough Bread | sourdough
Italian Bread
French Baguette | baguette
Ciabatta Bread | ciabatta
Naan Bread | naan
Pita Bread | pitas
Focaccia
Raisin Bread
Cinnamon Bread
Gluten-Free Bread
Texas Toast
Garlic Bread
Whole Grain Bread
Rustic Loaf
Brown Bread
Flatbread
"""

CATALOGUE[("Bakery", "Buns & Rolls")] = """
Hamburger Buns | burger buns
Hot Dog Buns | wiener buns
Dinner Rolls
Kaiser Rolls | kaisers
Brioche Buns
Pretzel Buns
Sub Buns | submarine buns; hoagie rolls
Slider Buns
Croissants
Crescent Rolls
Sausage Rolls
Portuguese Buns
"""

CATALOGUE[("Bakery", "Bagels & English Muffins")] = """
Bagels
Everything Bagels
Sesame Bagels
Cinnamon Raisin Bagels
Plain Bagels
Whole Wheat Bagels
English Muffins
Whole Wheat English Muffins
Crumpets
Mini Bagels
"""

CATALOGUE[("Bakery", "Tortillas & Wraps")] = """
Flour Tortillas | tortillas
Corn Tortillas | tacos
Whole Wheat Tortillas
Large Tortilla Wraps | wraps
Taco Shells | hard taco shells; tacos
Tostada Shells
Spinach Wraps
Low Carb Tortillas
"""

CATALOGUE[("Bakery", "Sweet Baked")] = """
Muffins
Blueberry Muffins
Chocolate Chip Muffins
Bran Muffins
Danishes | danish pastry
Cinnamon Rolls | cinnamon buns
Donuts | doughnuts
Scones
Banana Bread
Pound Cake
Coffee Cake
Turnovers
Eclairs
Butter Tarts
"""

CATALOGUE[("Bakery", "Desserts")] = """
Layer Cake | cake
Birthday Cake
Cheesecake
Apple Pie
Pumpkin Pie
Cherry Pie
Cupcakes
Brownies
Fruit Tarts
Bakery Cookies
Cake Slices
Trifle
Carrot Cake
Chocolate Cake
"""

CATALOGUE[("Pantry", "Breakfast")] = """
Breakfast Cereal | cereal
Bran Flakes
Corn Flakes
Raisin Bran
Rice Cereal | crisp rice cereal
Honey Nut Cereal
Granola
Instant Oatmeal
Steel Cut Oats
Large Flake Oats | rolled oats
Cream of Wheat
Pancake Mix
Waffle Mix
Maple Syrup
Pancake Syrup | table syrup
Breakfast Bars
Toaster Pastries
Muesli
Kids Cereal
Fibre Cereal
"""

CATALOGUE[("Pantry", "Pasta & Rice")] = """
Spaghetti
Penne
Rotini
Macaroni | elbow macaroni
Fusilli
Linguine
Fettuccine
Lasagna Noodles
Angel Hair Pasta
Rigatoni
Orzo
Egg Noodles
Whole Wheat Pasta
Gluten-Free Pasta
White Rice
Brown Rice
Basmati Rice | rice
Jasmine Rice
Arborio Rice
Wild Rice
Instant Rice | minute rice
Rice Noodles
Ramen Noodles
Udon Noodles
Couscous
Quinoa
Gnocchi
Bow Tie Pasta | farfalle
Shell Pasta
Tortellini
Fresh Ravioli
"""

CATALOGUE[("Pantry", "Canned Goods")] = """
Canned Tomatoes
Diced Tomatoes
Crushed Tomatoes
Tomato Paste
Canned Tomato Sauce
Canned Corn
Canned Peas
Canned Green Beans
Canned Mushrooms
Canned Tuna | tuna
Canned Salmon
Canned Chicken
Canned Sardines | sardines
Canned Peaches
Canned Pineapple
Canned Fruit Cocktail
Applesauce | apple sauce
Canned Pumpkin
Canned Coconut Milk
Green Olives | olives
Black Olives
Dill Pickles | pickles
Sweet Pickles
Bread and Butter Pickles
Roasted Red Peppers
Artichoke Hearts
Water Chestnuts
Canned Beets
Canned Carrots
Canned Mixed Vegetables
Canned Cherries
Canned Mandarin Oranges
"""

CATALOGUE[("Pantry", "Beans & Legumes")] = """
Black Beans
Kidney Beans
Chickpeas | garbanzo beans
White Kidney Beans
Navy Beans
Pinto Beans
Refried Beans
Baked Beans
Brown Lentils | lentils
Red Lentils
Green Lentils
Split Peas
Dried Black Beans
Mixed Beans
Romano Beans
"""

CATALOGUE[("Pantry", "Soup & Broth")] = """
Beef Broth
Vegetable Broth
Chicken Stock
Beef Stock
Bone Broth
Canned Soup
Chicken Noodle Soup
Tomato Soup
Cream of Mushroom Soup
Vegetable Soup
Minestrone Soup
Chili
Instant Soup Mix
Ramen Soup Cups | cup noodles
Bouillon Cubes | soup cubes
Onion Soup Mix
Chowder
"""

CATALOGUE[("Pantry", "Grains")] = """
Pearl Barley | barley
Bulgur
Farro
Millet
Cornmeal
Polenta
Wheat Bran
Wheat Germ
Steel Cut Barley
Buckwheat
"""

CATALOGUE[("Pantry", "International")] = """
Curry Paste
Rice Paper Wrappers
Nori Sheets | seaweed sheets
Miso Paste
Fish Sauce
Oyster Sauce
Hoisin Sauce
Sriracha Sauce | sriracha
Gochujang
Tahini
Harissa
Sambal Oelek
Wasabi Paste
Pickled Ginger
Kimchi
Firm Tofu | tofu
Silken Tofu
Tempeh
Coconut Cream
Plantain Chips Bag
Masa Harina
Rice Wine Vinegar
Panang Curry Sauce
Butter Chicken Sauce
Tikka Masala Sauce
"""

CATALOGUE[("Pantry", "Instant Foods")] = """
Instant Noodles
Boxed Mac and Cheese | kraft dinner; mac and cheese
Instant Mashed Potatoes
Instant Rice Cups
Boxed Stuffing | stuffing mix
Boxed Skillet Dinner
Canned Pasta
Instant Pudding
Instant Gravy Mix
Scalloped Potato Mix
Instant Noodle Bowls
"""

CATALOGUE[("Pantry", "Meal Kits")] = """
Fajita Kit
Curry Kit
Stir Fry Kit
Pasta Meal Kit
Pizza Kit
Sushi Kit
Burrito Kit
"""

CATALOGUE[("Pantry", "Sauces")] = """
Marinara Sauce
Alfredo Sauce
Rose Sauce
Pizza Sauce
Enchilada Sauce
Taco Sauce
Stir Fry Sauce
Teriyaki Sauce
Sweet and Sour Sauce
Gravy
Cranberry Sauce
Worcestershire Sauce
Steak Sauce
Tartar Sauce
Cocktail Sauce
Buffalo Sauce
Chili Sauce
Plum Sauce
Peanut Sauce
Marinade
"""

CATALOGUE[("Pantry", "Condiments")] = """
Yellow Mustard | mustard
Honey Mustard
Whole Grain Mustard
Sweet Relish | relish
Hot Sauce
Ranch Dressing | ranch
Caesar Dressing
Italian Dressing
Balsamic Dressing
Greek Dressing
Thousand Island Dressing
Poppyseed Dressing
Honey
Chocolate Hazelnut Spread | nutella style spread
Almond Butter
Marmalade
Grape Jelly | jelly
Strawberry Jam
Horseradish
Pickled Jalapenos
Aioli
Tartar Style Sauce
Maple Butter
Sunflower Seed Butter
Vinaigrette
"""

CATALOGUE[("Pantry", "Oils")] = """
Extra Virgin Olive Oil
Canola Oil
Avocado Oil
Coconut Oil
Sesame Oil
Peanut Oil
Sunflower Oil
Cooking Spray | pan spray
White Vinegar
Apple Cider Vinegar
Balsamic Vinegar
Red Wine Vinegar
Rice Vinegar
Grapeseed Oil
"""

CATALOGUE[("Pantry", "Baking")] = """
All-Purpose Flour | flour
Whole Wheat Flour
Bread Flour
Cake Flour
Gluten-Free Flour
Granulated Sugar | white sugar; sugar
Brown Sugar
Icing Sugar | powdered sugar; confectioners sugar
Baking Powder
Baking Soda
Active Dry Yeast | yeast
Cornstarch
Vanilla Extract
Chocolate Chips
Cocoa Powder
Shredded Coconut
Sweetened Condensed Milk | condensed milk
Evaporated Milk
Molasses
Corn Syrup
Food Colouring
Sprinkles
Cake Mix
Brownie Mix
Muffin Mix
Cookie Mix
Pie Crust
Pizza Dough
Bread Crumbs
Croutons
Gelatin
Marshmallows
Pudding Mix
Icing | frosting
Almond Flour
Oat Flour
Cream of Tartar
Candy Melts
Pie Filling
"""

CATALOGUE[("Pantry", "Spices")] = """
Table Salt | salt
Sea Salt
Kosher Salt
Black Pepper | pepper
Whole Peppercorns
Garlic Powder
Onion Powder
Paprika
Smoked Paprika
Ground Cumin | cumin
Ground Coriander
Turmeric
Curry Powder
Ground Cinnamon | cinnamon
Ground Nutmeg
Ground Cloves
Allspice
Ground Ginger
Cayenne Pepper
Crushed Red Pepper | chili flakes
Dried Oregano
Dried Basil
Dried Thyme
Dried Rosemary
Dried Parsley
Bay Leaves
Dill Weed
Ground Sage
Italian Seasoning
Herbes de Provence
Everything Bagel Seasoning
Lemon Pepper
Poultry Seasoning
Garlic Salt
Seasoning Salt
Montreal Steak Spice
Jerk Seasoning
Cajun Seasoning
Ranch Seasoning Mix
Chinese Five Spice
Garam Masala
Old Bay Style Seasoning
Vanilla Bean
Chili Seasoning Mix
"""

CATALOGUE[("Snacks", "Chips")] = """
Potato Chips | chips; crisps
Ripple Chips | ruffled chips; rippled chips
Kettle Chips | kettle cooked chips
All Dressed Chips | all dressed
Ketchup Chips
Salt and Vinegar Chips
BBQ Chips | barbecue chips
Sour Cream and Onion Chips
Plain Potato Chips | original chips; regular chips
Dill Pickle Chips
Tortilla Chips | nacho chips
Nacho Cheese Tortilla Chips
Corn Chips
Restaurant Style Tortilla Chips
Blue Corn Chips
Veggie Chips
Pita Chips
Plantain Chips
Sweet Potato Chips
Multigrain Chips
Cheese Flavoured Chips
Lightly Salted Chips
"""

CATALOGUE[("Snacks", "Crackers")] = """
Soda Crackers | saltines; saltine crackers
Water Crackers
Whole Grain Crackers
Cheese Crackers
Graham Crackers
Melba Toast
Crispbread
Rice Crackers
Butter Crackers
Sandwich Crackers
Wheat Crackers
Seed Crackers
Gluten-Free Crackers
"""

CATALOGUE[("Snacks", "Popcorn & Puffs")] = """
Popcorn
Microwave Popcorn
Kettle Corn
Caramel Corn | caramel popcorn
Cheese Popcorn
Ready-to-Eat Popcorn | bagged popcorn
Cheese Puffs | cheezies
Corn Puffs
Pretzels
Pretzel Sticks
Pretzel Twists
Pretzel Rods
Popcorn Kernels
White Cheddar Popcorn
"""

CATALOGUE[("Snacks", "Nuts & Seeds")] = """
Peanuts
Salted Peanuts
Cashews
Almonds
Walnuts
Pecans
Pistachios
Hazelnuts
Macadamia Nuts
Brazil Nuts
Mixed Nuts
Sunflower Seeds
Pumpkin Seeds | pepitas
Chia Seeds
Flax Seeds
Sesame Seeds
Trail Mix
Honey Roasted Peanuts
Smoked Almonds
Nut Clusters
"""

CATALOGUE[("Snacks", "Bars & Granola")] = """
Granola Bars
Chewy Granola Bars
Crunchy Granola Bars
Protein Bars
Energy Bars
Fruit and Nut Bars
Cereal Bars
Crisp Rice Squares | rice krispie squares
Oat Bars
Nut Butter Bars
Kids Granola Bars
"""

CATALOGUE[("Snacks", "Cookies")] = """
Chocolate Chip Cookies
Oatmeal Cookies
Sandwich Cookies | cream cookies
Shortbread Cookies
Digestive Biscuits
Wafer Cookies
Fig Bars
Animal Crackers
Ginger Snaps
Biscotti
Maple Cookies
Peanut Butter Cookies
Chocolate Covered Cookies
Tea Biscuits
"""

CATALOGUE[("Snacks", "Rice Cakes")] = """
Rice Cakes
Caramel Rice Cakes
Chocolate Rice Cakes
Corn Cakes
Popcorn Cakes
Mini Rice Cakes
"""

CATALOGUE[("Snacks", "Snack Mix")] = """
Snack Mix
Cheese Snack Mix
Party Mix
Puffed Snack Mix
Veggie Straws
Cheese Straws
Bagel Chips
Snack Crackers Mix
"""

CATALOGUE[("Snacks", "Fruit Snacks")] = """
Fruit Snacks
Fruit Strips | fruit leather
Fruit Rolls
Dried Fruit
Raisins
Dried Cranberries
Dried Mango
Dried Apricots
Banana Chips
Freeze-Dried Fruit
Apple Chips
Dried Blueberries
Fruit Bars
Yogurt Covered Raisins
"""

CATALOGUE[("Confectionery", "Chocolate")] = """
Chocolate Bar
Milk Chocolate Bar
Dark Chocolate Bar
White Chocolate Bar
Chocolate Almonds
Chocolate Raisins
Chocolate Truffles
Boxed Chocolates
Chocolate Squares
Chocolate Coins
Peanut Butter Cups
Chocolate Covered Pretzels
Chocolate Eggs
Caramel Chocolate Bar
Wafer Chocolate Bar
Chocolate Minis | fun size chocolate
Baking Chocolate Bar
"""

CATALOGUE[("Confectionery", "Candy")] = """
Hard Candy
Sour Candy
Assorted Candy Mix | candy mix
Lollipops | suckers
Caramels
Toffee
Taffy
Jelly Beans
Rock Candy
Candy Canes
Marshmallow Candy
Nougat Bar
Bulk Candy
Candy Necklace
Sour Keys
Salt Water Taffy
"""

CATALOGUE[("Confectionery", "Gummies")] = """
Gummy Bears
Gummy Worms
Sour Gummies
Gummy Candy | gummies
Wine Gums
Jujubes
Berry Gummies
Gummy Rings
Fruit Gummies
Sour Gummy Worms
"""

CATALOGUE[("Confectionery", "Licorice")] = """
Licorice
Red Licorice
Black Licorice
Licorice Twists
Licorice Allsorts
Licorice Nibs
"""

CATALOGUE[("Confectionery", "Gum & Mints")] = """
Chewing Gum | gum
Sugar-Free Gum
Bubble Gum
Mints
Breath Mints
Peppermints
Mint Tin
Cinnamon Gum
Breath Strips
"""

CATALOGUE[("Frozen", "Frozen Vegetables")] = """
Frozen Peas
Frozen Corn
Frozen Broccoli
Frozen Cauliflower
Frozen Green Beans
Frozen Spinach
Frozen Carrots
Frozen Brussels Sprouts
Frozen Edamame
Frozen Stir Fry Vegetables
Frozen Butternut Squash
Frozen Pepper Strips
Frozen Diced Onion
Frozen Asparagus
"""

CATALOGUE[("Frozen", "Frozen Fruit")] = """
Frozen Berries | mixed frozen berries
Frozen Strawberries
Frozen Blueberries
Frozen Mango
Frozen Pineapple
Frozen Mixed Fruit
Frozen Raspberries
Frozen Smoothie Mix
Frozen Bananas
Frozen Cherries
Frozen Peaches
Frozen Acai
"""

CATALOGUE[("Frozen", "Frozen Potatoes")] = """
Frozen French Fries | fries; french fries
Crinkle Cut Fries
Straight Cut Fries
Sweet Potato Fries
Hash Browns
Tater Tots
Potato Wedges
Frozen Roast Potatoes
Onion Rings
Poutine Kit
Shoestring Fries
Frozen Diced Potatoes
"""

CATALOGUE[("Frozen", "Frozen Pizza")] = """
Pepperoni Frozen Pizza
Cheese Frozen Pizza
Deluxe Frozen Pizza
Thin Crust Frozen Pizza
Rising Crust Frozen Pizza
Personal Frozen Pizza
Pizza Pockets | pizza pops
Frozen Flatbread Pizza
Gluten-Free Frozen Pizza
Frozen Pizza Crust
Hawaiian Frozen Pizza
"""

CATALOGUE[("Frozen", "Frozen Meat")] = """
Chicken Nuggets | nuggets
Breaded Chicken Cutlets
Popcorn Chicken
Frozen Chicken Breasts
Frozen Chicken Wings
Frozen Burgers | frozen patties
Frozen Meatballs
Frozen Sausages
Frozen Ground Beef
Frozen Turkey
Frozen Bacon
Frozen Chicken Burgers
Frozen Chicken Thighs
"""

CATALOGUE[("Frozen", "Frozen Seafood")] = """
Frozen Shrimp
Frozen Salmon
Frozen White Fish
Fish Sticks | fish fingers
Breaded Fish Fillets
Frozen Scallops
Frozen Calamari
Frozen Fish and Chips
Frozen Crab
Frozen Lobster
Frozen Cooked Shrimp
"""

CATALOGUE[("Frozen", "Frozen Meals")] = """
Frozen Lasagna
Frozen Entrees | tv dinner
Frozen Pasta Meal
Frozen Stir Fry Meal
Frozen Burrito
Frozen Pot Pie
Frozen Shepherds Pie
Frozen Perogies | pierogies; perogys
Frozen Dumplings
Frozen Spring Rolls
Frozen Samosas
Frozen Ravioli
Frozen Mac and Cheese
Frozen Butter Chicken
Frozen Fried Rice
Frozen Bowls
"""

CATALOGUE[("Frozen", "Frozen Appetizers")] = """
Mozzarella Sticks
Jalapeno Poppers
Frozen Party Wings
Mini Quiche
Frozen Egg Rolls
Frozen Potato Skins
Party Appetizer Platter
Frozen Meatball Appetizers
Frozen Bruschetta
Frozen Pigs in a Blanket
"""

CATALOGUE[("Frozen", "Frozen Breakfast")] = """
Frozen Waffles | waffles
Frozen Pancakes
Frozen French Toast
Breakfast Sandwiches
Frozen Sausage Patties
Frozen Hash Brown Patties
Frozen Breakfast Burrito
Frozen Breakfast Bowls
"""

CATALOGUE[("Frozen", "Frozen Bakery")] = """
Frozen Pie
Frozen Cheesecake
Frozen Bread Dough
Frozen Garlic Bread
Frozen Croissants
Frozen Cookie Dough
Frozen Puff Pastry
Frozen Phyllo Pastry
Frozen Tart Shells
Frozen Pie Shells
"""

CATALOGUE[("Frozen", "Frozen Dessert")] = """
Vanilla Ice Cream | ice cream
Chocolate Ice Cream
Strawberry Ice Cream
Neapolitan Ice Cream
Cookies and Cream Ice Cream
Mint Chocolate Chip Ice Cream
Butterscotch Ripple Ice Cream
Ice Cream Tub
Ice Cream Bars
Ice Cream Sandwiches
Ice Cream Cones
Frozen Yogurt
Sorbet
Sherbet
Italian Ice | italian ices
Ice Pops | freezies; popsicles; ice pops
Frozen Fruit Bars
Novelty Ice Cream
Ice Cream Cake
Non-Dairy Ice Cream
Chocolate Ice Cream Bars
Rainbow Ice Pops
Fudge Bars
Ice Cream Sundae Cups
"""

CATALOGUE[("Drinks", "Water")] = """
Sparkling Water
Flavoured Sparkling Water
Mineral Water
Spring Water
Distilled Water
Coconut Water
Water Jug
Club Soda | carbonated water; soda water
Tonic Water
Alkaline Water
Water Bottles Case | case of water
Flavoured Water
"""

CATALOGUE[("Drinks", "Juice")] = """
Apple Juice
Grape Juice
Cranberry Juice
Pineapple Juice
Tomato Juice
Vegetable Juice
Lemonade
Limeade
Fruit Punch
Mango Juice
Pomegranate Juice
Grapefruit Juice
Orange Juice No Pulp
Orange Juice with Pulp
Juice Concentrate | frozen juice concentrate
Smoothie
Green Juice
Apple Cider
Passion Fruit Juice
Peach Juice
"""

CATALOGUE[("Drinks", "Kids Drinks")] = """
Juice Pouches
Kids Smoothie
Flavoured Milk Boxes
Kids Drink Bottles
Freezie Drinks
"""

CATALOGUE[("Drinks", "Soft Drinks")] = """
Cola | coke; pop; soda
Diet Cola | diet coke
Zero Sugar Cola
Lemon Lime Soda | sprite style pop; 7up style pop
Ginger Ale
Diet Ginger Ale
Root Beer
Orange Soda | orange pop
Grape Soda
Cream Soda
Black Cherry Soda
Sparkling Juice
Soda Cans | pop cans
Soda Bottles | pop bottles
Diet Lemon Lime Soda
Fruit Soda
Cola Fridge Pack | pop fridge pack
"""

CATALOGUE[("Drinks", "Sports & Energy")] = """
Sports Drink | gatorade style drink
Electrolyte Drink
Energy Drink
Sugar-Free Energy Drink
Protein Shake
Meal Replacement Shake
Electrolyte Powder
Pre-Workout Drink
Coconut Electrolyte Drink
"""

CATALOGUE[("Drinks", "Tea")] = """
Black Tea
Green Tea
Herbal Tea
Chamomile Tea
Peppermint Tea
Earl Grey Tea
English Breakfast Tea
Chai Tea
Rooibos Tea
Matcha Powder | matcha
Tea Bags
Loose Leaf Tea
Iced Tea Mix
Sweet Tea
Lemon Tea
"""

CATALOGUE[("Drinks", "Coffee")] = """
Ground Coffee
Whole Bean Coffee
Coffee Pods | k cups
Instant Coffee
Decaf Coffee
Espresso Coffee | espresso
Cold Brew Coffee
Iced Coffee
Coffee Creamer
Flavoured Coffee
Dark Roast Coffee
Medium Roast Coffee
Light Roast Coffee
Coffee Filters
Coffee Whitener
"""

CATALOGUE[("Drinks", "Hot Chocolate")] = """
Hot Chocolate Mix | hot chocolate
Hot Chocolate Pods
Cocoa Mix
Marshmallow Hot Chocolate
Drinking Chocolate
"""

CATALOGUE[("Drinks", "Drink Mixes")] = """
Drink Crystals
Iced Tea Crystals
Lemonade Mix
Powdered Drink Mix
Water Enhancer
Electrolyte Tablets
Cocktail Mixer
Simple Syrup
Flavour Drops
"""

CATALOGUE[("Household", "Paper")] = """
Facial Tissue | kleenex; tissues
Napkins | serviettes
Paper Plates
Paper Cups
Paper Bowls
Plastic Cutlery
Shop Towels
Paper Towel Multipack
Toilet Paper Multipack | toilet paper; bathroom tissue
"""

CATALOGUE[("Household", "Waste")] = """
Kitchen Catchers | kitchen catcher bags
Compost Bags
Green Bin Bags
Outdoor Garbage Bags
Blue Box Bags
Bin Liners
Scented Garbage Bags
Yard Waste Bags
"""

CATALOGUE[("Household", "Storage")] = """
Heavy Duty Aluminum Foil | tin foil; foil
Freezer Bags
Sandwich Bags
Snack Bags
Reusable Containers
Food Containers | tupperware
Mason Jars
Wax Paper
Vacuum Seal Bags
Storage Bins
Resealable Bags | ziploc; zip lock bags
Cling Wrap | saran wrap
"""

CATALOGUE[("Household", "Cleaning")] = """
Floor Cleaner
Multi-Surface Cleaner
Disinfectant Spray
Bleach
Oven Cleaner
Stainless Steel Cleaner
Wood Cleaner
Carpet Cleaner
Mould Remover | mold remover
Drain Cleaner
Degreaser
Isopropyl Alcohol | rubbing alcohol
Vinegar Cleaner
Tub and Tile Cleaner
Descaler
Furniture Polish
"""

CATALOGUE[("Household", "Cleaning Tools")] = """
Sponges
Scrub Brush
Dish Cloths
Microfibre Cloths
Mop
Mop Refills
Broom
Dustpan
Duster
Rubber Gloves
Scouring Pads
Toilet Brush
Squeegee
Cleaning Bucket
Steel Wool
Scrub Sponges
Spray Bottle
"""

CATALOGUE[("Household", "Dishwashing")] = """
Dishwasher Detergent
Rinse Aid
Dishwasher Cleaner
Dish Soap Refill
Dishwasher Tablets
Dish Rack
"""

CATALOGUE[("Household", "Laundry")] = """
Liquid Laundry Detergent
Powder Laundry Detergent
Dryer Sheets
Dryer Balls
Colour-Safe Bleach
Laundry Bleach
Delicates Detergent
Scent Booster
Fabric Refresher
Lint Rollers
Laundry Sanitizer
Hypoallergenic Detergent
"""

CATALOGUE[("Household", "Home Supplies")] = """
Batteries C
Batteries D
9V Batteries
Button Batteries
LED Bulbs
Extension Cord
Duct Tape
Masking Tape
Glue
Matches
Lighters
Candles
Air Freshener
Furnace Filter
Water Filter
Water Filter Pitcher
Ice Melt
Insect Spray
Mouse Traps
Work Gloves
Rechargeable Batteries
Picture Hooks
Zip Ties
"""

CATALOGUE[("Health & Beauty", "Hair")] = """
Dry Shampoo
2-in-1 Shampoo
Dandruff Shampoo | anti dandruff shampoo
Kids Shampoo
Deep Conditioner
Hair Mask
Hair Spray
Hair Gel
Hair Mousse
Hair Oil
Hair Dye | hair colour
Hair Brush
Comb
Hair Ties | elastics
Bobby Pins
Leave-In Conditioner
Colour-Safe Shampoo
"""

CATALOGUE[("Health & Beauty", "Oral Care")] = """
Whitening Toothpaste
Kids Toothpaste
Sensitive Toothpaste
Mouthwash
Dental Floss | floss
Floss Picks
Electric Toothbrush
Toothbrush Heads
Denture Cleaner
Teeth Whitening Strips
Tongue Scraper
Interdental Brushes
"""

CATALOGUE[("Health & Beauty", "Personal Care")] = """
Bar Soap
Liquid Hand Soap
Moisturizing Body Wash
Loofah
Bath Bombs
Bubble Bath
Epsom Salts
Cotton Swabs | q tips
Cotton Balls
Nail Clippers
Nail File
Nail Polish
Nail Polish Remover
Tweezers
Hand Sanitizer
Lip Balm | chapstick
Foot Cream
Antiperspirant
Body Spray
Talc-Free Body Powder
"""

CATALOGUE[("Health & Beauty", "Skin Care")] = """
Face Wash
Facial Cleanser
Face Moisturizer
Face Cream
Body Lotion
Hand Cream
Sunscreen | sunblock
After Sun Lotion
Face Serum
Eye Cream
Face Mask
Facial Toner
Acne Treatment
Exfoliating Scrub
Petroleum Jelly | vaseline style jelly
Micellar Water
Makeup Remover Wipes
"""

CATALOGUE[("Health & Beauty", "Shaving")] = """
Disposable Razors
Razor Blades | razor refills
Shaving Cream
Shaving Gel
Aftershave
Electric Shaver
Beard Trimmer
Beard Oil
Waxing Strips
Womens Razors
"""

CATALOGUE[("Health & Beauty", "Feminine Care")] = """
Tampons
Menstrual Pads | pads
Panty Liners
Menstrual Cup
Feminine Wash
Feminine Wipes
Period Underwear
"""

CATALOGUE[("Health & Beauty", "Medicine Cabinet")] = """
Pain Reliever
Ibuprofen | advil style
Acetaminophen | tylenol style
Aspirin
Cold Medicine
Cough Syrup
Throat Lozenges
Antihistamine
Allergy Medicine
Antacid
Anti-Diarrheal
Laxative
Bandages | band aids
Gauze
Antibiotic Ointment
Antiseptic
Thermometer
Multivitamin | vitamins
Vitamin D
Vitamin C
Probiotics
Fish Oil
Cough Drops
Nasal Spray
Eye Drops
Heating Pad
Motion Sickness Tablets
Electrolyte Rehydration
Melatonin
Iron Supplement
Calcium Supplement
"""

CATALOGUE[("Baby & Kids", "Diapers & Wipes")] = """
Diapers
Newborn Diapers
Toddler Training Pants | pull ups
Baby Wipes | wipes
Sensitive Baby Wipes
Diaper Cream
Diaper Pail Refills
Swim Diapers
Changing Pads
Overnight Diapers
"""

CATALOGUE[("Baby & Kids", "Baby Food")] = """
Infant Formula | baby formula; formula
Baby Cereal
Baby Food Puree
Baby Food Pouches
Toddler Snacks
Yogurt Melts
Teething Biscuits
Baby Juice
Toddler Formula
"""

CATALOGUE[("Baby & Kids", "Baby Care")] = """
Baby Shampoo
Baby Lotion
Baby Powder
Baby Bath Wash
Baby Oil
Baby Sunscreen
Baby Bottles
Bottle Nipples
Soothers | pacifiers; sooters
Sippy Cups
Bibs
Baby Laundry Detergent
Nursing Pads
Baby Thermometer
"""

CATALOGUE[("Baby & Kids", "Kids Snacks")] = """
Kids Fruit Snacks
Kids Crackers
Kids Cookies
Kids Cheese Snacks
Lunch Kits | lunchables style kits
Kids Yogurt
Kids Applesauce Pouches
Kids Cereal Bars
School Snacks
Nut-Free Snacks
"""

CATALOGUE[("Pet", "Dog")] = """
Dry Dog Food | kibble
Wet Dog Food | canned dog food
Puppy Food
Grain-Free Dog Food
Dog Biscuits
Dog Chews
Rawhide Chews
Dental Chews
Dog Food Toppers
Senior Dog Food
Large Breed Dog Food
"""

CATALOGUE[("Pet", "Cat")] = """
Dry Cat Food
Wet Cat Food | canned cat food
Kitten Food
Cat Treats
Cat Litter
Clumping Cat Litter
Litter Deodorizer
Hairball Control Cat Food
Senior Cat Food
"""

CATALOGUE[("Pet", "Pet Supplies")] = """
Pet Waste Bags | poop bags
Pet Shampoo
Pet Wipes
Flea Treatment
Pet Bowls
Pet Toys
Pet Bed
Leash
Collar
Pet Brush
Litter Box
Pet Stain Remover
"""
