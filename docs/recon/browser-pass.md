# Browser pass on amazon.com (September 2026)

Done in a real Chrome session via Claude in Chrome, signed out first (visitor location: Singapore, so prices show S$ and international shipping). Screenshots are in `docs/recon/screenshots/`. These notes record what the live site does today where it differs from, or adds to, the desk research in `research-*.json`.

## Home (`01`)

- A **"Deliver to Singapore" toaster** under the location pin on first visit: "We're showing you items that ship to Singapore. To see items that ship to a different country, change your delivery address." with **Dismiss** / **Change Address** (yellow).
- For signed-out visitors, the **Account & Lists flyout opens by itself** on load, showing the yellow "Sign in" button and "New customer? Start here."
- **Hero:** a full-width seasonal banner ("Shop Back to School: School essentials at every price") with thin prev/next chevrons at the edges, fading into the page grey.
- **Four cards overlap the bottom of the hero:**
  - "Get your game on": one big image.
  - "Shop Fashion for less": a 2x2 quad with captions (Jeans under $50, Tops under $25, Dresses under $30, Shoes under $50).
  - "Top categories in Kitchen appliances": one big image plus three small ones (Cooker, Coffee, Pots and Pans, Kettles).
  - "Must-have school supplies": a 2x2 quad (Backpacks, Electronics, Stationery, Fashion).
- **Sub-nav:** All, Prime, … Gift Cards, Sell.

## Product detail (`10`–`15`)

- **Breadcrumb:** Home & Kitchen › Kitchen & Dining › Small Appliances. A sponsored brand strip sits above it.
- **Gallery:** the main image with "Click to see full view", and **thumbnails in a horizontal row under the main image** (not a vertical strip), plus a "19 VIDEOS" tile.
- **Center column:**
  - Title, then a subtitle line.
  - "Visit the Instant Pot Store".
  - `4.7 ★★★★½ ▾ (184,484)`, then "**10K+ bought** in past month".
  - Price with superscript cents, then "No Import Charges & S$49.18 Shipping to Singapore Details ▾" and "ⓘ Sales taxes may apply at checkout".
  - **Variant tiles** ("Size: 6 Quarts") showing each option's name and price in a bordered box; the selected tile gets a blue border.
  - Spec table (Brand, Capacity, Material, Finish Type, Product Dimensions, Special Feature) with "⌄ See more".
  - **About this item** bullets, each starting with a bold-ish lead phrase ("7 Cooking Functions: …"), then "⌄ Show more" and "› See more product details".
  - "Report an issue with this product or seller".
- **Buy box** (bordered card, right):
  - Price, shipping line, "S$49.18 delivery **Sunday, September 20**", "⊙ Deliver to Singapore", "In Stock" (green).
  - A **"Quantity: 1 ⌄"** grey pill select.
  - Yellow **Add to cart** and orange **Buy Now** full-width pills.
  - A table: Shipper / Seller Amazon.com · Returns "30-day refund / replacement" · Payment "Secure transaction", then "⌄ See more".
  - **Add to List**: a full-width white bordered button below a divider.
- **Sticky in-page nav** appears on scroll: "↑ Top | About this item | Similar | Product information | From the Brand | Reviews", with a mini product thumbnail and title on the right.
- **Frequently bought together:** "This item:" + 2 add-ons with `+` separators, "Total price: S$160.77", "Add all 3 to Cart", "These items are shipped from and sold by different sellers. Show details".
- **"Customers who viewed this item also viewed":** a carousel with "Page 1 of 4". Cards show:
  - a teal title link (2-4 lines), stars and count;
  - a badge ("Amazon's Choice" dark, "#1 Best Seller" orange, "Limited time deal" red);
  - "-10% S$102.65 List: S$114.06", "Typical: S$135.60";
  - "Get it by Sep 21 - 28", "Only 19 left in stock (more on the way)", "S$ 49.18 shipping".
- **Customer reviews:**
  - Left: "Customer reviews", stars "4.7 out of 5", "184,484 global ratings", 5 histogram rows ("5 star [bar] 84%") where the rows are links, and "How customer reviews and ratings work ⌄".
  - Right: "**Customers say**", an AI paragraph with "Generated from the text of customer reviews", then "Select to learn more" aspect chips with counts ("↗ Performance (26.9K)", "Ease of use (9.8K)", …).
  - "Reviews with images": a carousel with "See all photos ›".
  - "**Top reviews from the United States**", each with: avatar + name; stars + bold headline; "Reviewed in the United States on September 4, 2026"; "Size: 3 Quarts | **Verified Purchase**" (orange); body; "7 people found this helpful"; a "Helpful" pill and "| Report".

## Search results (`20`–`23`)

- **Top bar:** "1-16 of over 10,000 results for "wireless earbuds"", with a **"Sort by: Featured ⌄"** pill at top right.
- **Left rail, in this order:**
  - Popular Shopping Ideas (text links, "⌄ See more").
  - Customer Reviews (one "★★★★☆ & Up" row).
  - Brands (checkboxes + "See more").
  - Deals & Discounts (All Discounts, Buy More Save More, Coupons, Today's Deals).
  - Color swatches.
  - Category-specific checkbox groups (Noise Control, Connectivity, Wireless Technology, Condition, Features…).
- **"Results / Check each product page for other buying options."** heading above the list.
- **Electronics uses the list layout.** Each row has:
  - Image left; small "Sponsored ⓘ" label.
  - Title (18px, dark); a line like "#1 Top Rated" or "Top Reviewed for Battery life"; an "Overall Pick ⓘ" dark badge on the image corner.
  - Stars + count "(30.8K)"; "6K+ bought in past month".
  - Price "SGD101.37" with "Typical price: SGD253.47" strikethrough, or a green "Save 10%" tag + "with coupon".
  - "S$9.35 delivery **Wed, Sep 23**", "Ships to Singapore".
  - Yellow **Add to cart** pill, or a white "See options" pill for variant products; "+4 other colors/patterns".
- **Grid cards further down** add "Or fastest delivery **Mon, Sep 21**" and sustainability chips.
- **Bottom of the page:**
  - **Related searches**: a 3x2 grid of bordered tiles with a magnifier icon.
  - Boxed pagination "‹ Previous **1** 2 3 … 20 Next ›".
  - "**Need help?** Visit the help section or contact us".
- **Autocomplete:** the typed prefix is plain and the completion is **bold** ("wireless ear**buds**"). Some rows have a small product thumbnail instead of the magnifier. A visual "WIRELESS EARBUDS BY TYPE" row of image tiles (Running, Sport, With Neckband, Charging) sits under the list.

## Cart (`30`–`32`)

- **After Add to cart**, Amazon navigates to a confirmation page:
  - Left card: thumbnail + "✓ **Added to cart**" + "Size: 6 Quarts".
  - Right card: "Cart Subtotal: S$139.40", yellow "Proceed to checkout (1 item)", white "Go to Cart", "For best experience sign in to your account".
  - Below: a "Get everything you need" carousel with Add to cart buttons.
  - A **persistent mini-cart rail on the right edge** of the viewport: "Subtotal S$139.40", "Go to Cart", the item thumbnail + price, and a yellow-outlined "🗑 1 +" stepper.
- **Cart page:**
  - "Shopping Cart" heading with a "Price" column label.
  - Each line: image; title (2 lines); "In Stock" green; "☐ This is a gift Learn more"; "Size: 6 Quarts"; a **yellow-outlined pill stepper "🗑 1 +"**; "Delete | Save for later | Compare with similar items | Share".
  - "Subtotal (1 item): **S$139.40**" right-aligned under the lines.
  - Right rail: "Subtotal (1 item): S$139.40", "☐ This order contains a gift", yellow "Proceed to checkout"; then a "Your recently viewed items" card with an Add to cart button.
  - Fine print: "The price and availability of items at Amazon.com are subject to change. The Cart is a temporary place to store a list of your items and reflects each item's most recent price. Learn more" and "Do you have a gift card or promotional code? We'll ask you to enter your claim code when it's time to pay."
  - Carousels below: "New international customers purchased", "Recommended based on your shopping trends".

## Account & Lists flyout (`02`)

- Signed out: yellow "Sign in" pill, then "New customer? Start here."
- Two columns underneath:
  - **Your Lists:** Create a List, Find a List or Registry.
  - **Your Account:** Account, Orders, Recommendations, Browsing History, Your Shopping preferences, Watchlist, Video Purchases & Rentals, Kindle Unlimited, Content & Devices, Subscribe & Save Items, Memberships & Subscriptions, Music Library.
- The rest of the page dims behind the flyout.
- For nile we keep only the entries that work: Create a List, Account, Orders, Browsing History, Addresses, Sign Out.

## Checkout sign-in gate (`40`)

- "Proceed to checkout" while signed out goes to `/ap/signin` with `openid.return_to` pointing back at checkout, on a stripped page: logo only, no store header.
- The card reads "Sign in or create account", "Enter mobile number or email", a yellow "Continue", "By continuing, you agree to Amazon's Conditions of Use and Privacy Notice.", "Need help?", then a divider and "Buying for work? Create a free business account".
- Thin footer: Conditions of Use · Privacy Notice · Help, "© 1996-2026, Amazon.com, Inc. or its affiliates".
- nile's `/ap/signin` already follows this unified flow (email first, then password or create account), with `return_to`.

## Signed in (`screenshots-private/50`–`58`, kept out of git because they show account details)

The account used is an **Amazon Business** account, so the chrome differs from the consumer site:
- the "amazon business" logo, "Delivering to <city zip> / Update location" and a bell icon;
- "Hello, <name> / Account for Your Business";
- business sub-nav items (Business Essentials, Add Users, Subscribe & Save).

nile follows the consumer layout. Personal details are omitted below.

- **Home (signed in):**
  - The hero, then a row of five promo cards with carousel arrows ("Get up to $60 off", "Today's Deals", "Save on Case Packs"…).
  - Then personalized cards: "Continue searching for", "**Pick up where you left off**" (recently viewed products with price), "Continue shopping deals" (strikethrough prices), "Recommended for you in …".
  - nile's "Keep shopping for" / "Inspired by your browsing history" rows match this.
- **Your Account:**
  - An H1 with a "Manage your profile" link above a 2-column grid of big bordered cards (line icon, bold title, one-line description).
  - Cards: Your Orders "Track, return, or buy things again"; Login & security "Edit login, name, and mobile number"; Your Payments "Manage payment methods and settings, view balances and offers"; Gift cards "View balance or redeem a card"; Your Lists "View, modify, and share your lists, or create new ones"; plus a dark Prime promo card.
- **Your Orders (empty):**
  - Breadcrumb "Your Account > Your Orders"; H1 with a search box on the right ("Item, order or PO number...") and a dark "Search Orders" pill.
  - Tabs: Orders | Buy Again | Not Yet Shipped | Digital Orders | Amazon Pay | Cancelled Orders, with an orange underline on the active tab.
  - "Viewing 0 orders placed in [All orders ▾] [Last 3 months ▾]" and a "View order reports" pill.
  - Empty copy: "You have not placed any orders in Last 3 months. View orders in 2026."
  - A "Related to items you viewed" carousel below.
- **Your Addresses (empty):**
  - Breadcrumb, then a big dashed tile "＋ **Add Address**".
  - "Related: 1-Click Settings · Change address on an open order".
- **Add a new address:**
  - Breadcrumb "Your Account › Your Addresses › New Address"; "Or find an Amazon pickup location near you".
  - A light-blue banner "Save time. Autofill your current location. [Autofill]".
  - Fields, in order:
    - Country/Region (select).
    - "Full name (First and Last name)", prefilled from the account.
    - "Phone number", prefilled, with the hint "May be used to assist delivery".
    - "Street address" (placeholder "Street address or P.O. Box").
    - "Unit or suite number" (placeholder "Apt, suite, unit, building, floor, etc.").
    - **City / State (Select) / ZIP Code on one row.**
    - "☐ Make this my default address".
- **Lists (none yet):**
  - Left rail "Lists" with a "Create a list" pill.
  - Collapsible groups (Your reorder lists / Your shopping lists / Shared with you), each "None".
  - Main area: hero "Lists for all your shopping needs" with a yellow "Create a List", explainer tiles (Reorder List / Shopping List), and "Add items" / "Share your list" with "Show me how".
- **Wallet:**
  - Sub-tabs Overview | **Wallet** | Transactions | Settings; left column "Cards & accounts" with a dashed "⊕ Add a payment method" row; "Rewards & balances" (Gift Card balance $0.00).
  - White right panel: "You don't have any payment methods saved." with a yellow "Add a payment method".
- **Browsing history:**
  - Sub-nav: Your Amazon.com | Your Browsing History | Recommended For You | Improve Your Recommendations | Your Profile.
  - H1 "Your Browsing History" with a gear icon (turns history on or off); "These items were viewed recently. We use them to personalize recommendations."
  - Bordered tiles: image, title link, stars + count, red price, "FREE delivery **Sat, Sep 19**", and a "Remove from view" pill.
- **Empty cart (signed in):**
  - "Your Amazon Cart is empty" / "Your Shopping Cart lives to serve. Give it purpose — fill it with groceries, clothing, household supplies, electronics, and more. Continue shopping on the Amazon.com homepage, learn about today's deals, or visit your Wish List."
  - A "Your Items" box with tabs: No items saved for later | Buy it again | Lists.
  - Right rail "Your recently viewed items" ("Get it as soon as Saturday, Sep 19", "FREE Shipping by Amazon", "Add to cart").
- **Not captured:**
  - Signed-in checkout: on the Business account, Add to cart went through a business pricing flow and the cart stayed empty, so checkout wasn't reachable without placing orders.
  - Login & Security: it asks for the password again.
  - `research-cart-checkout.json` and `research-auth-account.json` cover both.
