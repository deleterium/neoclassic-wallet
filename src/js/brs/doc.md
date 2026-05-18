# Documentation for developers

## Number formats
Values of blockchain coin's (Signa) are called in 'amount', while values of colored coins (or assets or tokens) are called in 'quantity'.
* **Amount**: Signa amount is a human friendly format.
It is localized, so in english can be '1,234.56789012' or on portuguese '1.234,56789012'.
Signa values can have up to 8 decimals.
* **Quantity**: Asset quantity is a human friendly format.
Quantities can have can have from zero up to 8 decimals, depending on asset properties.
Quantity is a value localized.
If an asset has 2 decimals, valid values in english are '1234' or '12,345.01' or in portuguese '1234' or '12.345,01'
* **NQT**: Amounts in NQT are the blockchain format.
No decimals neither group separators allowed.
One Signa is '100000000'.
Used in the API as `balanceNQT`, `commitmentNQT` and others.
* **QNT**: Quantities in QNT are the blockchain format.
No decimals neither group separators allowed.
One asset unit depends on its decimals. If an asset has 2 decimals, asset quantity of '1.23' (en) is '123' in QNT.
Used in the API as `quantityQNT`, `balanceQNT` and others
* NumberObject: used internally to make easier to apply the format.

## Price formats
* **PriceQuantity**: An asset price in human friendly format.
Represents the price in Amount per Quantity.
Used to interact with humans in forms.
* **PriceNQT**: An asset price in blockchain format.
Represents the price in NQT per QNT.
Commonly used in the API as `priceNQT`.
