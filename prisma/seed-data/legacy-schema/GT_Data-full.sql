-- ----------------------------------------------------------
-- MDB Tools - A library for reading MS Access database files
-- Copyright (C) 2000-2011 Brian Bruns and others.
-- Files in libmdb are licensed under LGPL and the utilities under
-- the GPL, see COPYING.LIB and COPYING files respectively.
-- Check out http://mdbtools.sourceforge.net
-- ----------------------------------------------------------

SET client_encoding = 'UTF-8';

CREATE TABLE IF NOT EXISTS "000001tblautonumberlist"
 (
	"tablename"			VARCHAR (64), 
	"fieldname"			VARCHAR (64), 
	"maxvalue"			INTEGER, 
	"fieldnamerefnumber"			VARCHAR (50)
);

-- CREATE INDEXES ...

CREATE TABLE IF NOT EXISTS "000002tblautonumberlist"
 (
	"tablename"			VARCHAR (64), 
	"fieldname"			VARCHAR (64), 
	"maxvalue"			INTEGER
);

-- CREATE INDEXES ...

CREATE TABLE IF NOT EXISTS "aaccbanktransactions"
 (
	"btid"			SERIAL, 
	"checkspaidid"			INTEGER, 
	"bankaccount"			INTEGER, 
	"currency"			VARCHAR (50), 
	"banktratype"			INTEGER, 
	"tdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"ttime"			TIMESTAMP WITHOUT TIME ZONE, 
	"duedate"			TIMESTAMP WITHOUT TIME ZONE, 
	"tref"			VARCHAR (50), 
	"amountin"			REAL, 
	"amountout"			DOUBLE PRECISION, 
	"dollarrate"			REAL, 
	"checknumber"			VARCHAR (50), 
	"bank"			VARCHAR (50), 
	"checkdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"note"			VARCHAR (50), 
	"description"			VARCHAR (100), 
	"account2"			INTEGER, 
	"account2amt"			REAL, 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"status"			VARCHAR (50)
);
COMMENT ON COLUMN "aaccbanktransactions"."checkspaidid" IS 'Checks Paid';
COMMENT ON COLUMN "aaccbanktransactions"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "aaccbanktransactions_bank_idx" ON "aaccbanktransactions" ("bank");
CREATE INDEX "aaccbanktransactions_btid_idx" ON "aaccbanktransactions" ("btid");
CREATE INDEX "aaccbanktransactions_checknumber_idx" ON "aaccbanktransactions" ("checknumber");
CREATE INDEX "aaccbanktransactions_codeid_idx" ON "aaccbanktransactions" ("codeid");
CREATE INDEX "aaccbanktransactions_employeeid_idx" ON "aaccbanktransactions" ("employeeid");
CREATE UNIQUE INDEX "aaccbanktransactions_id2_idx" ON "aaccbanktransactions" ("checkspaidid");
CREATE INDEX "aaccbanktransactions_jvid_idx" ON "aaccbanktransactions" ("jvid");
ALTER TABLE "aaccbanktransactions" ADD CONSTRAINT "aaccbanktransactions_pkey" PRIMARY KEY ("btid");

CREATE TABLE IF NOT EXISTS "aaccounts"
 (
	"aaccid"			SERIAL, 
	"aaccountmainid"			INTEGER, 
	"aaccountmainno"			INTEGER, 
	"aaccountsubno"			INTEGER, 
	"aaname"			VARCHAR (50), 
	"abankname"			VARCHAR (50), 
	"balance"			REAL, 
	"aaccounttype"			INTEGER, 
	"acurrency"			VARCHAR (50), 
	"debitamttotal"			REAL, 
	"creditamttotal"			REAL, 
	"balanceamttotal"			REAL, 
	"aaccounttype2"			INTEGER, 
	"openbalance"			REAL, 
	"abank"			INTEGER
);

-- CREATE INDEXES ...
CREATE INDEX "aaccounts_aaccountmainid_idx" ON "aaccounts" ("aaccountmainid");
CREATE UNIQUE INDEX "aaccounts_aaccountsubno_idx" ON "aaccounts" ("aaccountsubno");
CREATE INDEX "aaccounts_bankid_idx" ON "aaccounts" ("aaccid");
ALTER TABLE "aaccounts" ADD CONSTRAINT "aaccounts_pkey" PRIMARY KEY ("aaccid");

CREATE TABLE IF NOT EXISTS "aaccountstateofacc"
 (
	"id"			SERIAL, 
	"aaccount"			INTEGER, 
	"aamountin"			REAL, 
	"aamountout"			REAL, 
	"aaccountcur"			VARCHAR (50), 
	"tid"			INTEGER, 
	"tref"			VARCHAR (50), 
	"ttype"			VARCHAR (50), 
	"tkind"			VARCHAR (80), 
	"tdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"tduedate"			TIMESTAMP WITHOUT TIME ZONE, 
	"ttime"			TIMESTAMP WITHOUT TIME ZONE, 
	"anow"			TIMESTAMP WITHOUT TIME ZONE, 
	"aaccountrelative"			INTEGER, 
	"clientid"			INTEGER, 
	"clienttype"			VARCHAR (50), 
	"clientname"			VARCHAR (50), 
	"clientname2"			VARCHAR (50), 
	"employeeid"			INTEGER, 
	"fromaaccount"			INTEGER, 
	"fromaamount"			REAL, 
	"fromaacurrency"			VARCHAR (50), 
	"amount"			REAL, 
	"toaaccount"			INTEGER, 
	"toaamount"			REAL, 
	"toaacurrency"			VARCHAR (50), 
	"exchangerate"			DOUBLE PRECISION, 
	"paymentmethod"			INTEGER, 
	"checknumber"			VARCHAR (50), 
	"ccno"			VARCHAR (50), 
	"bankduedate"			DATE, 
	"bankname"			VARCHAR (50), 
	"note1"			VARCHAR (50), 
	"note2"			VARCHAR (50), 
	"bankpass"			BOOLEAN NOT NULL
);
COMMENT ON COLUMN "aaccountstateofacc"."aaccountcur" IS 'AAccountCurrency';

-- CREATE INDEXES ...
CREATE INDEX "aaccountstateofacc_bank_idx" ON "aaccountstateofacc" ("bankname");
CREATE INDEX "aaccountstateofacc_checknumber_idx" ON "aaccountstateofacc" ("checknumber");
CREATE INDEX "aaccountstateofacc_clientid_idx" ON "aaccountstateofacc" ("clientid");
CREATE INDEX "aaccountstateofacc_clientname_idx" ON "aaccountstateofacc" ("clientname");
CREATE INDEX "aaccountstateofacc_clientname2_idx" ON "aaccountstateofacc" ("clientname2");
CREATE INDEX "aaccountstateofacc_clienttype_idx" ON "aaccountstateofacc" ("clienttype");
CREATE INDEX "aaccountstateofacc_employeeid_idx" ON "aaccountstateofacc" ("employeeid");
CREATE INDEX "aaccountstateofacc_id_idx" ON "aaccountstateofacc" ("id");
ALTER TABLE "aaccountstateofacc" ADD CONSTRAINT "aaccountstateofacc_pkey" PRIMARY KEY ("id");
CREATE INDEX "aaccountstateofacc_tid_idx" ON "aaccountstateofacc" ("tid");

CREATE TABLE IF NOT EXISTS "aaccounttypes"
 (
	"accounttypeid"			SERIAL, 
	"accounttype"			VARCHAR (50), 
	"accounttypear"			VARCHAR (50)
);

-- CREATE INDEXES ...
ALTER TABLE "aaccounttypes" ADD CONSTRAINT "aaccounttypes_pkey" PRIMARY KEY ("accounttypeid");

CREATE TABLE IF NOT EXISTS "accounts"
 (
	"accid"			SERIAL, 
	"accountname"			VARCHAR (50) NOT NULL, 
	"bankname"			VARCHAR (50), 
	"accountno"			VARCHAR (50), 
	"account"			REAL, 
	"accounttype"			INTEGER, 
	"acurrency"			VARCHAR (50), 
	"openbalance"			REAL, 
	"aaccountmainid"			INTEGER, 
	"aaccountmainno"			INTEGER, 
	"aaccountsubno"			INTEGER, 
	"aaccounttype"			INTEGER
);

-- CREATE INDEXES ...
CREATE INDEX "accounts_aaccountmainid_idx" ON "accounts" ("aaccountmainid");
CREATE UNIQUE INDEX "accounts_aaccountsubno_idx" ON "accounts" ("aaccountsubno");
CREATE INDEX "accounts_bankid_idx" ON "accounts" ("accid");
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("accid");

CREATE TABLE IF NOT EXISTS "accountstatement"
 (
	"id"			SERIAL, 
	"accountname"			INTEGER, 
	"tid"			INTEGER, 
	"tref"			VARCHAR (50), 
	"ttype"			VARCHAR (50), 
	"tdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"ttime"			TIMESTAMP WITHOUT TIME ZONE, 
	"anow"			TIMESTAMP WITHOUT TIME ZONE, 
	"clientid"			INTEGER, 
	"clienttype"			VARCHAR (50), 
	"clientname"			VARCHAR (50), 
	"clientname2"			VARCHAR (50), 
	"fromaccount"			INTEGER, 
	"fromamount"			REAL, 
	"fromacurrency"			VARCHAR (50), 
	"amount"			REAL, 
	"toaccount"			INTEGER, 
	"toamount"			REAL, 
	"toacurrency"			VARCHAR (50), 
	"exchangerate"			DOUBLE PRECISION, 
	"account"			INTEGER, 
	"paymentmethod"			INTEGER, 
	"checknumber"			VARCHAR (50), 
	"ccno"			VARCHAR (50), 
	"duedate"			DATE, 
	"bankname"			VARCHAR (50), 
	"note1"			VARCHAR (50), 
	"note2"			VARCHAR (50), 
	"bankpass"			BOOLEAN NOT NULL
);

-- CREATE INDEXES ...
CREATE INDEX "accountstatement_bank_idx" ON "accountstatement" ("bankname");
CREATE INDEX "accountstatement_checknumber_idx" ON "accountstatement" ("checknumber");
CREATE INDEX "accountstatement_clientid_idx" ON "accountstatement" ("clientid");
CREATE INDEX "accountstatement_clientname_idx" ON "accountstatement" ("clientname");
CREATE INDEX "accountstatement_clientname2_idx" ON "accountstatement" ("clientname2");
CREATE INDEX "accountstatement_clienttype_idx" ON "accountstatement" ("clienttype");
CREATE INDEX "accountstatement_id_idx" ON "accountstatement" ("id");
ALTER TABLE "accountstatement" ADD CONSTRAINT "accountstatement_pkey" PRIMARY KEY ("id");
CREATE INDEX "accountstatement_tid_idx" ON "accountstatement" ("tid");

CREATE TABLE IF NOT EXISTS "accountstatement prev"
 (
	"id"			SERIAL, 
	"date"			TIMESTAMP WITHOUT TIME ZONE, 
	"ref"			VARCHAR (50), 
	"type"			VARCHAR (50), 
	"accountname"			INTEGER, 
	"fromaccount"			INTEGER, 
	"fromamount"			REAL, 
	"toaccount"			INTEGER, 
	"toamount"			REAL, 
	"account"			INTEGER, 
	"checknumber"			VARCHAR (50), 
	"ccno"			VARCHAR (50), 
	"duedate"			DATE, 
	"bankname"			VARCHAR (255), 
	"notes"			VARCHAR (50), 
	"bankpass"			BOOLEAN NOT NULL
);

-- CREATE INDEXES ...
CREATE INDEX "accountstatement prev_checknumber_idx" ON "accountstatement prev" ("checknumber");
CREATE INDEX "accountstatement prev_id_idx" ON "accountstatement prev" ("id");
ALTER TABLE "accountstatement prev" ADD CONSTRAINT "accountstatement prev_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "accounttransactions"
 (
	"id"			SERIAL, 
	"atref"			VARCHAR (50), 
	"atdate"			DATE, 
	"attime"			TIMESTAMP WITHOUT TIME ZONE, 
	"atnow"			TIMESTAMP WITHOUT TIME ZONE, 
	"fromaccount"			INTEGER, 
	"fromacurrency"			VARCHAR (50), 
	"amount01f"			REAL, 
	"amount"			REAL, 
	"amount02t"			REAL, 
	"checkno"			VARCHAR (50), 
	"duedate"			TIMESTAMP WITHOUT TIME ZONE, 
	"ccno"			VARCHAR (50), 
	"bankname"			VARCHAR (50), 
	"toaccount"			INTEGER, 
	"toacurrency"			VARCHAR (50), 
	"exchangerate"			DOUBLE PRECISION, 
	"note"			VARCHAR (50), 
	"calced"			VARCHAR (50), 
	"qtyed"			VARCHAR (50), 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"employeeid"			INTEGER
);
COMMENT ON COLUMN "accounttransactions"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "accounttransactions_codeid_idx" ON "accounttransactions" ("codeid");
CREATE INDEX "accounttransactions_employeeid_idx" ON "accounttransactions" ("employeeid");
CREATE INDEX "accounttransactions_id_idx" ON "accounttransactions" ("id");
CREATE INDEX "accounttransactions_jvid_idx" ON "accounttransactions" ("jvid");
ALTER TABLE "accounttransactions" ADD CONSTRAINT "accounttransactions_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "acctrannameinfo"
 (
	"idd"			SERIAL, 
	"acctrantype"			VARCHAR (50), 
	"acctranname"			VARCHAR (50), 
	"date1"			DATE, 
	"date2"			DATE, 
	"pendingqty"			INTEGER, 
	"transferqty"			INTEGER, 
	"note1"			VARCHAR (100), 
	"note2"			VARCHAR (100)
);

-- CREATE INDEXES ...
CREATE INDEX "acctrannameinfo_idd_idx" ON "acctrannameinfo" ("idd");
ALTER TABLE "acctrannameinfo" ADD CONSTRAINT "acctrannameinfo_pkey" PRIMARY KEY ("idd");

CREATE TABLE IF NOT EXISTS "addeditemtable"
 (
	"addedid"			SERIAL, 
	"itemno"			INTEGER, 
	"itemgroupid"			INTEGER, 
	"itemname"			VARCHAR (50), 
	"itemnameeng"			VARCHAR (50), 
	"itemvalue"			REAL, 
	"itemnote"			VARCHAR (50), 
	"checkbox"			BOOLEAN NOT NULL, 
	"countableprod"			BOOLEAN NOT NULL, 
	"prodid"			INTEGER, 
	"qtyyy"			REAL
);
COMMENT ON COLUMN "addeditemtable"."itemnameeng" IS 'English';
COMMENT ON COLUMN "addeditemtable"."countableprod" IS 'is that Added to count how much use';

-- CREATE INDEXES ...
CREATE INDEX "addeditemtable_additemid_idx" ON "addeditemtable" ("addedid");
CREATE INDEX "addeditemtable_itemgroupid_idx" ON "addeditemtable" ("itemgroupid");
ALTER TABLE "addeditemtable" ADD CONSTRAINT "addeditemtable_pkey" PRIMARY KEY ("addedid");
CREATE INDEX "addeditemtable_prodid_idx" ON "addeditemtable" ("prodid");

CREATE TABLE IF NOT EXISTS "addgrouptable"
 (
	"addgroupid"			SERIAL, 
	"addgroup"			VARCHAR (50), 
	"addgnote"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "addgrouptable_addgroupid_idx" ON "addgrouptable" ("addgroupid");
ALTER TABLE "addgrouptable" ADD CONSTRAINT "addgrouptable_pkey" PRIMARY KEY ("addgroupid");

CREATE TABLE IF NOT EXISTS "addtable"
 (
	"addid"			SERIAL, 
	"custinvoicedetailid"			INTEGER, 
	"addno"			INTEGER, 
	"addname"			VARCHAR (50), 
	"addqty"			REAL, 
	"addprice"			REAL, 
	"addnote"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "addtable_addid_idx" ON "addtable" ("addid");
CREATE INDEX "addtable_custinvoicedetailid_idx" ON "addtable" ("custinvoicedetailid");
ALTER TABLE "addtable" ADD CONSTRAINT "addtable_pkey" PRIMARY KEY ("addid");

CREATE TABLE IF NOT EXISTS "all"
 (
	"id"			SERIAL, 
	"date"			TIMESTAMP WITHOUT TIME ZONE, 
	"sales"			REAL, 
	"cash"			REAL, 
	"credit"			REAL, 
	"profit"			REAL, 
	"custpay"			REAL, 
	"custpaydollar"			REAL, 
	"custpayll"			REAL, 
	"custpaycheck"			REAL, 
	"custpaycheckdollar"			REAL, 
	"custpaycheckll"			REAL, 
	"expenses"			REAL, 
	"expensesusd"			REAL, 
	"expenseslbp"			REAL, 
	"expcheckusd"			REAL, 
	"expchecklbp"			REAL, 
	"suppay"			REAL, 
	"suppaydollar"			REAL, 
	"suppayll"			REAL, 
	"suppaycheck"			REAL, 
	"suppaycheckdollar"			REAL, 
	"suppaycheckll"			REAL, 
	"cashin"			REAL, 
	"cashout"			REAL, 
	"checkinusd"			DOUBLE PRECISION, 
	"checkoutusd"			DOUBLE PRECISION, 
	"checkinlbp"			DOUBLE PRECISION, 
	"checkoutlbp"			DOUBLE PRECISION, 
	"custcn"			REAL, 
	"custpv"			REAL, 
	"custretsale"			REAL, 
	"custretprofit"			REAL, 
	"suppur"			REAL, 
	"supcn"			REAL, 
	"dollarratev"			REAL, 
	"cashinusd"			DOUBLE PRECISION, 
	"cashinlbp"			DOUBLE PRECISION, 
	"cashoutusd"			DOUBLE PRECISION, 
	"cashoutlbp"			DOUBLE PRECISION, 
	"suppv"			REAL, 
	"wuinusd"			REAL, 
	"wuoutusd"			REAL, 
	"wuinlbp"			REAL, 
	"wuoutlbp"			REAL, 
	"exchangeusd"			REAL, 
	"exchangelbp"			REAL
);
COMMENT ON COLUMN "all"."custcn" IS 'Cust Credit Note';
COMMENT ON COLUMN "all"."custpv" IS 'Cust Pur Vouche';
COMMENT ON COLUMN "all"."custretsale" IS 'Cust Return Sale';
COMMENT ON COLUMN "all"."custretprofit" IS 'Cust Return Profit';
COMMENT ON COLUMN "all"."suppur" IS 'Sup Purchase';
COMMENT ON COLUMN "all"."supcn" IS 'Sup Credit Note';
COMMENT ON COLUMN "all"."suppv" IS 'Sup Pur Voucher';

-- CREATE INDEXES ...
CREATE INDEX "all_id_idx" ON "all" ("id");
ALTER TABLE "all" ADD CONSTRAINT "all_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "bankfund"
 (
	"bankfundid"			SERIAL, 
	"bankfunddate"			DATE, 
	"bankfundtime"			TIMESTAMP WITHOUT TIME ZONE, 
	"transtype"			VARCHAR (50), 
	"transid"			INTEGER, 
	"transref"			VARCHAR (50), 
	"tradate"			DATE, 
	"tratime"			TIMESTAMP WITHOUT TIME ZONE, 
	"amountout"			DOUBLE PRECISION, 
	"currency"			VARCHAR (50), 
	"usdlbprate"			DOUBLE PRECISION, 
	"eurusdrate"			DOUBLE PRECISION, 
	"usd"			DOUBLE PRECISION, 
	"lbp"			REAL, 
	"eur"			DOUBLE PRECISION, 
	"toaccount"			INTEGER, 
	"fromaccount"			INTEGER, 
	"paymentmethod"			VARCHAR (50), 
	"checknumber"			VARCHAR (50), 
	"bank"			VARCHAR (50), 
	"checkdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"checkpass"			VARCHAR (50), 
	"notes"			VARCHAR (150), 
	"checkstransref"			INTEGER
);

-- CREATE INDEXES ...
CREATE INDEX "bankfund_bank_idx" ON "bankfund" ("bank");
CREATE INDEX "bankfund_checknumber_idx" ON "bankfund" ("checknumber");
CREATE INDEX "bankfund_paydetid_idx" ON "bankfund" ("bankfundid");
CREATE INDEX "bankfund_paymentid_idx" ON "bankfund" ("transid");
ALTER TABLE "bankfund" ADD CONSTRAINT "bankfund_pkey" PRIMARY KEY ("bankfundid");
CREATE INDEX "bankfund_transid_idx" ON "bankfund" ("transref");

CREATE TABLE IF NOT EXISTS "bankname"
 (
	"id"			SERIAL, 
	"bankn"			VARCHAR (50), 
	"note"			VARCHAR (50), 
	"checkprintcur"			VARCHAR (50), 
	"mybankcheck"			BOOLEAN NOT NULL
);

-- CREATE INDEXES ...
CREATE INDEX "bankname_id_idx" ON "bankname" ("id");
ALTER TABLE "bankname" ADD CONSTRAINT "bankname_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "banktransactions"
 (
	"btid"			SERIAL, 
	"checkspaidid"			INTEGER, 
	"bankaccount"			INTEGER, 
	"currency"			VARCHAR (50), 
	"banktratype"			INTEGER, 
	"tdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"ttime"			TIMESTAMP WITHOUT TIME ZONE, 
	"duedate"			TIMESTAMP WITHOUT TIME ZONE, 
	"tref"			VARCHAR (50), 
	"amountin"			REAL, 
	"amountout"			DOUBLE PRECISION, 
	"dollarrate"			REAL, 
	"checknumber"			VARCHAR (50), 
	"bank"			VARCHAR (50), 
	"checkdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"note"			VARCHAR (50), 
	"description"			VARCHAR (100), 
	"account2"			INTEGER, 
	"account2amt"			REAL, 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"status"			VARCHAR (50)
);
COMMENT ON COLUMN "banktransactions"."checkspaidid" IS 'Checks Paid';
COMMENT ON COLUMN "banktransactions"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "banktransactions_bank_idx" ON "banktransactions" ("bank");
CREATE INDEX "banktransactions_btid_idx" ON "banktransactions" ("btid");
CREATE INDEX "banktransactions_checknumber_idx" ON "banktransactions" ("checknumber");
CREATE INDEX "banktransactions_codeid_idx" ON "banktransactions" ("codeid");
CREATE INDEX "banktransactions_employeeid_idx" ON "banktransactions" ("employeeid");
CREATE UNIQUE INDEX "banktransactions_id2_idx" ON "banktransactions" ("checkspaidid");
CREATE INDEX "banktransactions_jvid_idx" ON "banktransactions" ("jvid");
ALTER TABLE "banktransactions" ADD CONSTRAINT "banktransactions_pkey" PRIMARY KEY ("btid");

CREATE TABLE IF NOT EXISTS "banktransactions pre"
 (
	"btid"			SERIAL, 
	"bankaccount"			INTEGER, 
	"tdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"tref"			VARCHAR (50), 
	"amountin"			DOUBLE PRECISION, 
	"amountout"			DOUBLE PRECISION, 
	"fromaccount"			VARCHAR (50), 
	"description"			VARCHAR (50), 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER
);

-- CREATE INDEXES ...
CREATE INDEX "banktransactions pre_btid_idx" ON "banktransactions pre" ("btid");
CREATE INDEX "banktransactions pre_jvid_idx" ON "banktransactions pre" ("jvid");
ALTER TABLE "banktransactions pre" ADD CONSTRAINT "banktransactions pre_pkey" PRIMARY KEY ("btid");

CREATE TABLE IF NOT EXISTS "banktratype"
 (
	"bttid"			SERIAL, 
	"banktratypename"			VARCHAR (70), 
	"note1"			VARCHAR (50), 
	"note2"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "banktratype_bttid_idx" ON "banktratype" ("bttid");
ALTER TABLE "banktratype" ADD CONSTRAINT "banktratype_pkey" PRIMARY KEY ("bttid");

CREATE TABLE IF NOT EXISTS "barcodeprintlist"
 (
	"autoid"			SERIAL, 
	"prodid"			INTEGER, 
	"prodname"			VARCHAR (50), 
	"unitprice"			REAL, 
	"categoryid"			INTEGER NOT NULL, 
	"unitofmeas"			INTEGER, 
	"barcodetext"			VARCHAR (50), 
	"note"			VARCHAR (50), 
	"check2print"			BOOLEAN NOT NULL
);

-- CREATE INDEXES ...
CREATE INDEX "barcodeprintlist_autoid_idx" ON "barcodeprintlist" ("autoid");
CREATE INDEX "barcodeprintlist_categoryid_idx" ON "barcodeprintlist" ("categoryid");
ALTER TABLE "barcodeprintlist" ADD CONSTRAINT "barcodeprintlist_pkey" PRIMARY KEY ("autoid");
CREATE INDEX "barcodeprintlist_prodid_idx" ON "barcodeprintlist" ("prodid");

CREATE TABLE IF NOT EXISTS "bnamelist"
 (
	"id"			SERIAL, 
	"bname"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "bnamelist_id_idx" ON "bnamelist" ("id");
ALTER TABLE "bnamelist" ADD CONSTRAINT "bnamelist_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "cashbalance"
 (
	"id"			SERIAL, 
	"cashdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"cashtime"			TIMESTAMP WITHOUT TIME ZONE, 
	"employee"			INTEGER, 
	"ref1"			VARCHAR (50), 
	"ref2"			VARCHAR (50), 
	"cashtype"			VARCHAR (50), 
	"amountusdin"			REAL, 
	"amountllin"			REAL, 
	"amountusdout"			REAL, 
	"amountllout"			REAL, 
	"dollarrate"			DOUBLE PRECISION, 
	"incleint"			INTEGER, 
	"insource"			INTEGER, 
	"outcleint"			INTEGER, 
	"outsource"			INTEGER, 
	"outexreceipt"			INTEGER, 
	"expentype"			INTEGER, 
	"desc"			VARCHAR (50), 
	"note"			VARCHAR (50)
);
COMMENT ON COLUMN "cashbalance"."amountllout" IS ' ';
COMMENT ON COLUMN "cashbalance"."incleint" IS 'Customers  In';
COMMENT ON COLUMN "cashbalance"."insource" IS 'SourceCashInOut    In';
COMMENT ON COLUMN "cashbalance"."outcleint" IS 'Suppliers  Out';
COMMENT ON COLUMN "cashbalance"."outsource" IS 'SourceCashInOut    Out';
COMMENT ON COLUMN "cashbalance"."outexreceipt" IS 'Expenses Receipt Out';
COMMENT ON COLUMN "cashbalance"."expentype" IS 'Expense Type';

-- CREATE INDEXES ...
CREATE INDEX "cashbalance_id_idx" ON "cashbalance" ("id");
ALTER TABLE "cashbalance" ADD CONSTRAINT "cashbalance_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "cashinout"
 (
	"id"			SERIAL, 
	"cashdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"sname"			INTEGER, 
	"rname"			INTEGER, 
	"type"			VARCHAR (50), 
	"cashin"			DOUBLE PRECISION, 
	"cashout"			DOUBLE PRECISION, 
	"paymentmethod"			INTEGER, 
	"note"			VARCHAR (150), 
	"dollarrate"			DOUBLE PRECISION, 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"aaccountmainid"			INTEGER, 
	"cashinusd"			DOUBLE PRECISION, 
	"cashinlbp"			DOUBLE PRECISION, 
	"cashoutusd"			DOUBLE PRECISION, 
	"cashoutlbp"			DOUBLE PRECISION, 
	"tansref"			VARCHAR (50)
);
COMMENT ON COLUMN "cashinout"."sname" IS 'Source Name';
COMMENT ON COLUMN "cashinout"."rname" IS 'Recp Name';
COMMENT ON COLUMN "cashinout"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "cashinout_aaccountmainid_idx" ON "cashinout" ("aaccountmainid");
CREATE INDEX "cashinout_codeid_idx" ON "cashinout" ("codeid");
CREATE INDEX "cashinout_employeeid_idx" ON "cashinout" ("employeeid");
CREATE INDEX "cashinout_id_idx" ON "cashinout" ("id");
CREATE INDEX "cashinout_jvid_idx" ON "cashinout" ("jvid");
ALTER TABLE "cashinout" ADD CONSTRAINT "cashinout_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "cellsoftwlastprice"
 (
	"custinvoiceid"			SERIAL, 
	"invno"			INTEGER, 
	"ldate"			TIMESTAMP WITHOUT TIME ZONE, 
	"customerwsid"			DOUBLE PRECISION, 
	"oldcustid"			INTEGER, 
	"productid"			INTEGER, 
	"quantity"			DOUBLE PRECISION, 
	"unitprice"			DOUBLE PRECISION, 
	"proddollarrate"			DOUBLE PRECISION, 
	"unitpriceequcur"			DOUBLE PRECISION
);

-- CREATE INDEXES ...
CREATE INDEX "cellsoftwlastprice_custinvoiceid_idx" ON "cellsoftwlastprice" ("custinvoiceid");
CREATE INDEX "cellsoftwlastprice_customerwsid_idx" ON "cellsoftwlastprice" ("customerwsid");
CREATE INDEX "cellsoftwlastprice_oldcustid_idx" ON "cellsoftwlastprice" ("oldcustid");
CREATE INDEX "cellsoftwlastprice_productid_idx" ON "cellsoftwlastprice" ("productid");

CREATE TABLE IF NOT EXISTS "chartdata"
 (
	"iiddd"			SERIAL, 
	"frdate"			DATE, 
	"tidate"			DATE, 
	"worker"			INTEGER, 
	"chartdate"			DATE, 
	"note1"			TEXT, 
	"note2"			VARCHAR (50), 
	"t600"			VARCHAR (50), 
	"t630"			VARCHAR (50), 
	"t700"			VARCHAR (50), 
	"t730"			VARCHAR (50), 
	"t800"			VARCHAR (50), 
	"t830"			VARCHAR (50), 
	"t900"			VARCHAR (50), 
	"t930"			VARCHAR (50), 
	"t1000"			VARCHAR (50), 
	"t1030"			VARCHAR (50), 
	"t1100"			VARCHAR (50), 
	"t1130"			VARCHAR (50), 
	"t1200"			VARCHAR (50), 
	"t1230"			VARCHAR (50), 
	"t1300"			VARCHAR (50), 
	"t1330"			VARCHAR (50), 
	"t1400"			VARCHAR (50), 
	"t1430"			VARCHAR (50), 
	"t1500"			VARCHAR (50), 
	"t1530"			VARCHAR (50), 
	"t1600"			VARCHAR (50), 
	"t1630"			VARCHAR (50), 
	"t1700"			VARCHAR (50), 
	"t1730"			VARCHAR (50), 
	"t1800"			VARCHAR (50), 
	"t1830"			VARCHAR (50), 
	"t1900"			VARCHAR (50), 
	"t1930"			VARCHAR (50), 
	"t2000"			VARCHAR (50), 
	"t2030"			VARCHAR (50), 
	"t2100"			VARCHAR (50), 
	"t2130"			VARCHAR (50), 
	"t2200"			VARCHAR (50), 
	"t2230"			VARCHAR (50), 
	"t2300"			VARCHAR (50), 
	"t2330"			VARCHAR (50), 
	"t2400"			VARCHAR (50), 
	"t2430"			VARCHAR (50), 
	"note3"			TEXT
);
COMMENT ON COLUMN "chartdata"."frdate" IS 'From';
COMMENT ON COLUMN "chartdata"."tidate" IS 'Till';

-- CREATE INDEXES ...
ALTER TABLE "chartdata" ADD CONSTRAINT "chartdata_pkey" PRIMARY KEY ("iiddd");

CREATE TABLE IF NOT EXISTS "checkinout"
 (
	"id"			SERIAL, 
	"cdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"sname"			INTEGER, 
	"type"			VARCHAR (50), 
	"checkinusd"			DOUBLE PRECISION, 
	"checkinlbp"			DOUBLE PRECISION, 
	"checkoutusd"			DOUBLE PRECISION, 
	"checkoutlbp"			DOUBLE PRECISION, 
	"note"			VARCHAR (150), 
	"dollarrate"			DOUBLE PRECISION, 
	"checknumber"			VARCHAR (50), 
	"bank"			VARCHAR (50), 
	"checkdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"checkpass"			VARCHAR (50), 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50)
);
COMMENT ON COLUMN "checkinout"."cdate" IS 'Operation Date';
COMMENT ON COLUMN "checkinout"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "checkinout_bank_idx" ON "checkinout" ("bank");
CREATE INDEX "checkinout_checknumber_idx" ON "checkinout" ("checknumber");
CREATE INDEX "checkinout_codeid_idx" ON "checkinout" ("codeid");
CREATE INDEX "checkinout_employeeid_idx" ON "checkinout" ("employeeid");
CREATE INDEX "checkinout_id_idx" ON "checkinout" ("id");
CREATE INDEX "checkinout_jvid_idx" ON "checkinout" ("jvid");
ALTER TABLE "checkinout" ADD CONSTRAINT "checkinout_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "checksdata"
 (
	"id"			SERIAL, 
	"transdate"			DATE, 
	"transtime"			TIMESTAMP WITHOUT TIME ZONE, 
	"transtype"			VARCHAR (50), 
	"transrefid"			INTEGER, 
	"type"			VARCHAR (50), 
	"cleintid"			INTEGER, 
	"cleintname"			VARCHAR (50), 
	"clienttype"			VARCHAR (50), 
	"dollarrate"			DOUBLE PRECISION, 
	"eurrate"			DOUBLE PRECISION, 
	"paymentmethod"			INTEGER, 
	"currency"			VARCHAR (50), 
	"usd"			DOUBLE PRECISION, 
	"lbp"			REAL, 
	"eur"			DOUBLE PRECISION, 
	"checkno"			VARCHAR (50), 
	"bankname"			VARCHAR (50), 
	"duedate"			TIMESTAMP WITHOUT TIME ZONE, 
	"checkpass"			VARCHAR (50), 
	"note"			VARCHAR (50), 
	"checkstransref"			INTEGER
);

-- CREATE INDEXES ...
CREATE INDEX "checksdata_cleintid_idx" ON "checksdata" ("cleintid");
CREATE INDEX "checksdata_id_idx" ON "checksdata" ("id");
ALTER TABLE "checksdata" ADD CONSTRAINT "checksdata_pkey" PRIMARY KEY ("id");
CREATE INDEX "checksdata_transrefid_idx" ON "checksdata" ("transrefid");

CREATE TABLE IF NOT EXISTS "checksprintdata"
 (
	"iddd"			SERIAL, 
	"clientname"			VARCHAR (50), 
	"amountc"			REAL, 
	"currency"			VARCHAR (50), 
	"bankname"			VARCHAR (50), 
	"printingcur"			VARCHAR (50), 
	"checkdate"			DATE, 
	"placename"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "checksprintdata_iddd_idx" ON "checksprintdata" ("iddd");
ALTER TABLE "checksprintdata" ADD CONSTRAINT "checksprintdata_pkey" PRIMARY KEY ("iddd");

CREATE TABLE IF NOT EXISTS "consprod"
 (
	"consid"			SERIAL, 
	"consno"			INTEGER, 
	"customerwsid"			INTEGER, 
	"custtype"			INTEGER, 
	"projectnameinv"			VARCHAR (50), 
	"account"			DOUBLE PRECISION, 
	"status"			VARCHAR (20), 
	"custinvoicedate"			DATE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"discountinv"			REAL, 
	"vatinv"			REAL, 
	"amountinv"			REAL, 
	"notes"			VARCHAR (50), 
	"dollarrate"			REAL, 
	"insideinote"			VARCHAR (50), 
	"currency"			VARCHAR (50), 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"stockref"			INTEGER
);
COMMENT ON COLUMN "consprod"."consid" IS 'Consumed Products';
COMMENT ON COLUMN "consprod"."insideinote" IS 'Inside Inv  Note';
COMMENT ON COLUMN "consprod"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "consprod_codeid_idx" ON "consprod" ("codeid");
CREATE INDEX "consprod_customerid_idx" ON "consprod" ("customerwsid");
CREATE INDEX "consprod_employeeid_idx" ON "consprod" ("employeeid");
CREATE UNIQUE INDEX "consprod_invid_idx" ON "consprod" ("consno");
CREATE INDEX "consprod_jvid_idx" ON "consprod" ("jvid");
ALTER TABLE "consprod" ADD CONSTRAINT "consprod_pkey" PRIMARY KEY ("consid");

CREATE TABLE IF NOT EXISTS "consproddet"
 (
	"consdetailid"			SERIAL, 
	"consid"			INTEGER, 
	"productid"			INTEGER, 
	"barcode"			INTEGER, 
	"unit"			INTEGER, 
	"jalekh"			BOOLEAN NOT NULL, 
	"shateb"			BOOLEAN NOT NULL, 
	"sand"			BOOLEAN NOT NULL, 
	"quantity"			REAL, 
	"lenght"			REAL, 
	"width"			REAL, 
	"meas"			REAL, 
	"uprice"			REAL, 
	"unitprice"			REAL, 
	"unitpricelbp"			REAL, 
	"initialprice"			REAL, 
	"discount"			REAL, 
	"note"			VARCHAR (150), 
	"sn1"			VARCHAR (50), 
	"sn2"			VARCHAR (50), 
	"orderid"			INTEGER, 
	"projectnamedet"			VARCHAR (50), 
	"check"			BOOLEAN NOT NULL, 
	"insideidnote"			VARCHAR (50), 
	"stockref"			INTEGER, 
	"proddate"			DATE
);
COMMENT ON COLUMN "consproddet"."jalekh" IS '--';
COMMENT ON COLUMN "consproddet"."shateb" IS '--';
COMMENT ON COLUMN "consproddet"."sand" IS '---------';
COMMENT ON COLUMN "consproddet"."insideidnote" IS 'Inside Inv Details Note';

-- CREATE INDEXES ...
CREATE INDEX "consproddet_custinvoicedetailid_idx" ON "consproddet" ("consdetailid");
CREATE INDEX "consproddet_custinvoiceid_idx" ON "consproddet" ("consid");
CREATE INDEX "consproddet_orderid_idx" ON "consproddet" ("orderid");
ALTER TABLE "consproddet" ADD CONSTRAINT "consproddet_pkey" PRIMARY KEY ("consdetailid");
CREATE INDEX "consproddet_prodcode_idx" ON "consproddet" ("barcode");
CREATE INDEX "consproddet_productid_idx" ON "consproddet" ("productid");

CREATE TABLE IF NOT EXISTS "creditnote"
 (
	"id"			SERIAL, 
	"cnid"			INTEGER, 
	"cndate"			DATE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"customer"			INTEGER, 
	"dollarrate"			DOUBLE PRECISION, 
	"perpose"			VARCHAR (100), 
	"invno"			VARCHAR (100), 
	"amt"			REAL, 
	"amtusd"			REAL, 
	"amtlbp"			REAL, 
	"paymentmethod"			VARCHAR (50), 
	"checknumber"			VARCHAR (50), 
	"bank"			VARCHAR (50), 
	"checkdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"note"			VARCHAR (100), 
	"currency"			VARCHAR (50), 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"salesman"			INTEGER, 
	"status"			VARCHAR (50), 
	"tansref"			VARCHAR (50), 
	"custproj"			INTEGER
);
COMMENT ON COLUMN "creditnote"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';
COMMENT ON COLUMN "creditnote"."salesman" IS 'ExReceipt';

-- CREATE INDEXES ...
CREATE INDEX "creditnote_bank_idx" ON "creditnote" ("bank");
CREATE INDEX "creditnote_checknumber_idx" ON "creditnote" ("checknumber");
CREATE INDEX "creditnote_cnid_idx" ON "creditnote" ("cnid");
CREATE INDEX "creditnote_codeid_idx" ON "creditnote" ("codeid");
CREATE INDEX "creditnote_employeeid_idx" ON "creditnote" ("employeeid");
CREATE INDEX "creditnote_id_idx" ON "creditnote" ("id");
CREATE INDEX "creditnote_jvid_idx" ON "creditnote" ("jvid");
ALTER TABLE "creditnote" ADD CONSTRAINT "creditnote_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "currencydet"
 (
	"id"			SERIAL, 
	"fromdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"todate"			TIMESTAMP WITHOUT TIME ZONE, 
	"u100"			INTEGER, 
	"u50"			INTEGER, 
	"u20"			INTEGER, 
	"u10"			INTEGER, 
	"u5"			INTEGER, 
	"u1"			INTEGER, 
	"l100k"			INTEGER, 
	"l50k"			INTEGER, 
	"l20k"			INTEGER, 
	"l10k"			INTEGER, 
	"l5k"			INTEGER, 
	"l1k"			INTEGER, 
	"l500"			INTEGER, 
	"l250"			INTEGER, 
	"cc"			REAL, 
	"ccll"			REAL, 
	"tansref"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "currencydet_id_idx" ON "currencydet" ("id");
ALTER TABLE "currencydet" ADD CONSTRAINT "currencydet_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "custinvoicedetails"
 (
	"custinvoicedetailid"			SERIAL, 
	"custinvoiceid"			INTEGER, 
	"productid"			INTEGER, 
	"prodcodeno"			INTEGER, 
	"prodcodetxt"			INTEGER, 
	"barcode"			INTEGER, 
	"unit"			INTEGER, 
	"jalekh"			BOOLEAN NOT NULL, 
	"shateb"			BOOLEAN NOT NULL, 
	"sand"			BOOLEAN NOT NULL, 
	"quantity"			REAL, 
	"lenght"			REAL, 
	"width"			REAL, 
	"meas"			REAL, 
	"uprice"			REAL, 
	"unitprice"			REAL, 
	"unitpricelbp"			REAL, 
	"initialprice"			REAL, 
	"discount"			REAL, 
	"note"			VARCHAR (150), 
	"sn1"			VARCHAR (50), 
	"sn2"			VARCHAR (50), 
	"orderid"			INTEGER, 
	"projectnamedet"			VARCHAR (50), 
	"check"			BOOLEAN NOT NULL, 
	"insideidnote"			VARCHAR (50), 
	"unitpricestandard"			REAL, 
	"discountstandard"			REAL, 
	"quantity1"			REAL, 
	"itemsaledate"			DATE, 
	"measoflwq1"			REAL, 
	"hidedetails1"			BOOLEAN NOT NULL, 
	"hidedetails2"			BOOLEAN NOT NULL, 
	"prevcustinvoiceiddet"			INTEGER, 
	"stockref"			INTEGER, 
	"vatrate"			REAL, 
	"vatrateinc"			REAL, 
	"proddate"			DATE, 
	"monoqty"			REAL, 
	"invdetlinetotal"			REAL, 
	"saledetcreatedate"			TIMESTAMP WITHOUT TIME ZONE, 
	"saledetstatusname"			VARCHAR (50), 
	"saledetstatusdate"			TIMESTAMP WITHOUT TIME ZONE
);
COMMENT ON COLUMN "custinvoicedetails"."jalekh" IS '--';
COMMENT ON COLUMN "custinvoicedetails"."shateb" IS '--';
COMMENT ON COLUMN "custinvoicedetails"."sand" IS '---------';
COMMENT ON COLUMN "custinvoicedetails"."insideidnote" IS 'Inside Inv Details Note';
COMMENT ON COLUMN "custinvoicedetails"."unitpricestandard" IS 'UnitPrice Standard, as set';
COMMENT ON COLUMN "custinvoicedetails"."discountstandard" IS 'UnitPrice Standard, as set';
COMMENT ON COLUMN "custinvoicedetails"."measoflwq1" IS 'Lenght * Width *Quantity1';
COMMENT ON COLUMN "custinvoicedetails"."monoqty" IS 'Qty Mfara2 case of Pack , example   10 * 4  + ((2))  = 42   2: is mono';

-- CREATE INDEXES ...
CREATE INDEX "custinvoicedetails_custinvoicedetailid_idx" ON "custinvoicedetails" ("custinvoicedetailid");
CREATE INDEX "custinvoicedetails_custinvoiceid_idx" ON "custinvoicedetails" ("custinvoiceid");
CREATE INDEX "custinvoicedetails_orderid_idx" ON "custinvoicedetails" ("orderid");
CREATE INDEX "custinvoicedetails_prevcustinvid_idx" ON "custinvoicedetails" ("prevcustinvoiceiddet");
ALTER TABLE "custinvoicedetails" ADD CONSTRAINT "custinvoicedetails_pkey" PRIMARY KEY ("custinvoicedetailid");
CREATE INDEX "custinvoicedetails_prodcode_idx" ON "custinvoicedetails" ("barcode");
CREATE INDEX "custinvoicedetails_prodcodeno_idx" ON "custinvoicedetails" ("prodcodeno");
CREATE INDEX "custinvoicedetails_prodcodetxt_idx" ON "custinvoicedetails" ("prodcodetxt");
CREATE INDEX "custinvoicedetails_productid_idx" ON "custinvoicedetails" ("productid");

CREATE TABLE IF NOT EXISTS "custinvoices1"
 (
	"custinvoiceid"			SERIAL, 
	"codeid"			VARCHAR (50), 
	"invid"			INTEGER, 
	"custsup"			INTEGER, 
	"customerwsid"			INTEGER, 
	"custtype"			INTEGER, 
	"projectnameinv"			VARCHAR (50), 
	"account"			DOUBLE PRECISION, 
	"status"			VARCHAR (20), 
	"custinvoicedate"			DATE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"discountinv"			REAL, 
	"vatinv"			REAL, 
	"amountinv"			REAL, 
	"notes"			VARCHAR (50), 
	"dollarrate"			REAL, 
	"insideinote"			VARCHAR (200), 
	"currency"			VARCHAR (50), 
	"duedate"			DATE, 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"salesman"			INTEGER, 
	"prevcustinvoiceid"			INTEGER, 
	"paymethod"			VARCHAR (50), 
	"amountgiven"			DOUBLE PRECISION, 
	"amountreturn"			DOUBLE PRECISION, 
	"paid"			BOOLEAN NOT NULL, 
	"payid"			INTEGER, 
	"payamount"			DOUBLE PRECISION, 
	"calced"			VARCHAR (50), 
	"qtyed"			VARCHAR (50), 
	"currency1"			INTEGER, 
	"delivery"			VARCHAR (50), 
	"transstatus"			INTEGER
);
COMMENT ON COLUMN "custinvoices1"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';
COMMENT ON COLUMN "custinvoices1"."insideinote" IS 'Inside Inv  Note';
COMMENT ON COLUMN "custinvoices1"."salesman" IS 'ExReceipt';

-- CREATE INDEXES ...
CREATE INDEX "custinvoices1_codeid_idx" ON "custinvoices1" ("codeid");
CREATE INDEX "custinvoices1_customerid_idx" ON "custinvoices1" ("customerwsid");
CREATE INDEX "custinvoices1_employeeid_idx" ON "custinvoices1" ("employeeid");
CREATE INDEX "custinvoices1_invid_idx" ON "custinvoices1" ("invid");
CREATE INDEX "custinvoices1_jvid_idx" ON "custinvoices1" ("jvid");
CREATE INDEX "custinvoices1_payid_idx" ON "custinvoices1" ("payid");
CREATE INDEX "custinvoices1_prevcustinvoiceid_idx" ON "custinvoices1" ("prevcustinvoiceid");
ALTER TABLE "custinvoices1" ADD CONSTRAINT "custinvoices1_pkey" PRIMARY KEY ("custinvoiceid");

CREATE TABLE IF NOT EXISTS "custinvstockdetails"
 (
	"custinvstockdetailid"			SERIAL, 
	"custinvstockid"			INTEGER, 
	"productid"			INTEGER, 
	"prodcodeno"			INTEGER, 
	"prodcodetxt"			INTEGER, 
	"barcode"			INTEGER, 
	"unit"			INTEGER, 
	"jalekh"			BOOLEAN NOT NULL, 
	"shateb"			BOOLEAN NOT NULL, 
	"sand"			BOOLEAN NOT NULL, 
	"quantity"			REAL, 
	"lenght"			REAL, 
	"width"			REAL, 
	"meas"			REAL, 
	"uprice"			REAL, 
	"unitprice"			REAL, 
	"unitpricelbp"			REAL, 
	"initialprice"			REAL, 
	"discount"			REAL, 
	"note"			VARCHAR (150), 
	"sn1"			VARCHAR (50), 
	"sn2"			VARCHAR (50), 
	"orderid"			INTEGER, 
	"projectnamedet"			VARCHAR (50), 
	"check"			BOOLEAN NOT NULL, 
	"insideidnote"			VARCHAR (50), 
	"unitpricestandard"			REAL, 
	"discountstandard"			REAL
);
COMMENT ON COLUMN "custinvstockdetails"."jalekh" IS '--';
COMMENT ON COLUMN "custinvstockdetails"."shateb" IS '--';
COMMENT ON COLUMN "custinvstockdetails"."sand" IS '---------';
COMMENT ON COLUMN "custinvstockdetails"."insideidnote" IS 'Inside Inv Details Note';
COMMENT ON COLUMN "custinvstockdetails"."unitpricestandard" IS 'UnitPrice Standard, as set';
COMMENT ON COLUMN "custinvstockdetails"."discountstandard" IS 'UnitPrice Standard, as set';

-- CREATE INDEXES ...
CREATE INDEX "custinvstockdetails_custinvoicedetailid_idx" ON "custinvstockdetails" ("custinvstockdetailid");
CREATE INDEX "custinvstockdetails_custinvoiceid_idx" ON "custinvstockdetails" ("custinvstockid");
CREATE INDEX "custinvstockdetails_orderid_idx" ON "custinvstockdetails" ("orderid");
ALTER TABLE "custinvstockdetails" ADD CONSTRAINT "custinvstockdetails_pkey" PRIMARY KEY ("custinvstockdetailid");
CREATE INDEX "custinvstockdetails_prodcode_idx" ON "custinvstockdetails" ("barcode");
CREATE INDEX "custinvstockdetails_prodcodeno_idx" ON "custinvstockdetails" ("prodcodeno");
CREATE INDEX "custinvstockdetails_prodcodetxt_idx" ON "custinvstockdetails" ("prodcodetxt");
CREATE INDEX "custinvstockdetails_productid_idx" ON "custinvstockdetails" ("productid");

CREATE TABLE IF NOT EXISTS "custlinksalesmandays"
 (
	"id"			SERIAL, 
	"custid"			INTEGER, 
	"salesmanid"			INTEGER, 
	"dayssid"			INTEGER, 
	"note"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "custlinksalesmandays_customerwsid_idx" ON "custlinksalesmandays" ("custid");
CREATE INDEX "custlinksalesmandays_dayssid_idx" ON "custlinksalesmandays" ("salesmanid");
CREATE INDEX "custlinksalesmandays_dayssid1_idx" ON "custlinksalesmandays" ("dayssid");
CREATE INDEX "custlinksalesmandays_idd_idx" ON "custlinksalesmandays" ("id");
ALTER TABLE "custlinksalesmandays" ADD CONSTRAINT "custlinksalesmandays_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "customers"
 (
	"customerid"			SERIAL, 
	"name"			VARCHAR (50), 
	"contactfirstname"			VARCHAR (30), 
	"contactlastname"			VARCHAR (50), 
	"billingaddress"			VARCHAR (255), 
	"city"			VARCHAR (50), 
	"country/region"			VARCHAR (50), 
	"contacttitle"			VARCHAR (50), 
	"phonenumber"			VARCHAR (30), 
	"faxnumber"			VARCHAR (30), 
	"emailaddress"			VARCHAR (50), 
	"acc"			DOUBLE PRECISION, 
	"notes"			TEXT, 
	"account"			DOUBLE PRECISION
);

-- CREATE INDEXES ...
CREATE INDEX "customers_companyname_idx" ON "customers" ("name");
CREATE INDEX "customers_contactlastname_idx" ON "customers" ("contactlastname");
CREATE INDEX "customers_emailaddress_idx" ON "customers" ("emailaddress");
ALTER TABLE "customers" ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("customerid");

CREATE TABLE IF NOT EXISTS "customerwholesale"
 (
	"customerwsid"			SERIAL, 
	"bname"			VARCHAR (50), 
	"custwholesalename"			VARCHAR (50), 
	"contactfirstname"			VARCHAR (30), 
	"contactlastname"			VARCHAR (50), 
	"custtype"			INTEGER, 
	"level"			INTEGER, 
	"billingaddress"			VARCHAR (255), 
	"city"			VARCHAR (50), 
	"country/region"			VARCHAR (50), 
	"region"			INTEGER, 
	"contacttitle"			VARCHAR (50), 
	"phonenumber"			VARCHAR (30), 
	"faxnumber"			VARCHAR (30), 
	"emailaddress"			VARCHAR (50), 
	"wsacc"			DOUBLE PRECISION, 
	"notes"			TEXT, 
	"wsaccount"			DOUBLE PRECISION, 
	"preaccount"			DOUBLE PRECISION, 
	"bback"			REAL, 
	"custsup"			INTEGER, 
	"stockname"			VARCHAR (50), 
	"aaccount"			INTEGER, 
	"aaccid"			INTEGER, 
	"salesman"			INTEGER, 
	"aaccountmainid"			INTEGER, 
	"balancelimit"			REAL, 
	"price1"			REAL, 
	"price2"			REAL, 
	"dob"			TIMESTAMP WITHOUT TIME ZONE, 
	"school"			VARCHAR (50), 
	"insured"			VARCHAR (50), 
	"bloodtype"			VARCHAR (50), 
	"activecust"			BOOLEAN NOT NULL, 
	"stockref"			INTEGER, 
	"custrefno"			INTEGER, 
	"custstock1"			REAL, 
	"custstock2"			REAL, 
	"custstock3"			REAL, 
	"custstock4"			REAL, 
	"saleprice1"			REAL, 
	"saleprice2"			REAL, 
	"saleprice3"			REAL, 
	"bbackusdrate"			REAL, 
	"wsaccequiv"			DOUBLE PRECISION, 
	"wsaccountequiv"			DOUBLE PRECISION, 
	"preaccountequiv"			DOUBLE PRECISION
);
COMMENT ON COLUMN "customerwholesale"."customerwsid" IS 'Wholesale';
COMMENT ON COLUMN "customerwholesale"."bname" IS 'Before Name : Mr.;Eng.;Mrs.;Dr.;Miss;Sheikh;Messrs.';
COMMENT ON COLUMN "customerwholesale"."salesman" IS 'ExReceipt';
COMMENT ON COLUMN "customerwholesale"."custstock1" IS 'Using For Now for Water Galon Cust Stock';
COMMENT ON COLUMN "customerwholesale"."custstock2" IS 'Using For Now for Water Galon Cust Stock';
COMMENT ON COLUMN "customerwholesale"."custstock3" IS 'Using For Now for Water Galon Cust Stock';
COMMENT ON COLUMN "customerwholesale"."custstock4" IS 'Using For Now for Water Galon Cust Stock';

-- CREATE INDEXES ...
CREATE INDEX "customerwholesale_aaccid_idx" ON "customerwholesale" ("aaccid");
CREATE INDEX "customerwholesale_aaccountmainid_idx" ON "customerwholesale" ("aaccountmainid");
CREATE UNIQUE INDEX "customerwholesale_companyname_idx" ON "customerwholesale" ("custwholesalename");
CREATE INDEX "customerwholesale_contactlastname_idx" ON "customerwholesale" ("contactlastname");
CREATE INDEX "customerwholesale_emailaddress_idx" ON "customerwholesale" ("emailaddress");
ALTER TABLE "customerwholesale" ADD CONSTRAINT "customerwholesale_pkey" PRIMARY KEY ("customerwsid");

CREATE TABLE IF NOT EXISTS "custordersdetails"
 (
	"custordersdetailid"			SERIAL, 
	"custordersid"			INTEGER, 
	"productid"			INTEGER, 
	"prodcodeno"			INTEGER, 
	"prodcodetxt"			INTEGER, 
	"barcode"			INTEGER, 
	"prodcode"			VARCHAR (50), 
	"unit"			INTEGER, 
	"jalekh"			BOOLEAN NOT NULL, 
	"shateb"			BOOLEAN NOT NULL, 
	"sand"			BOOLEAN NOT NULL, 
	"quantity"			REAL, 
	"lenght"			REAL, 
	"width"			REAL, 
	"meas"			REAL, 
	"uprice"			REAL, 
	"unitprice"			REAL, 
	"unitpricelbp"			REAL, 
	"initialprice"			REAL, 
	"discount"			REAL, 
	"note"			VARCHAR (150), 
	"sn1"			VARCHAR (50), 
	"sn2"			VARCHAR (50), 
	"print"			BOOLEAN NOT NULL, 
	"projectnamedet"			VARCHAR (50), 
	"check"			BOOLEAN NOT NULL, 
	"insideodnote"			VARCHAR (50), 
	"unitpricestandard"			REAL, 
	"discountstandard"			REAL, 
	"quantity1"			REAL, 
	"itemsaledate"			DATE, 
	"measoflwq1"			REAL, 
	"prevcustorderiddet"			INTEGER, 
	"stockref"			INTEGER
);
COMMENT ON COLUMN "custordersdetails"."jalekh" IS '--';
COMMENT ON COLUMN "custordersdetails"."shateb" IS '--';
COMMENT ON COLUMN "custordersdetails"."sand" IS '---------';
COMMENT ON COLUMN "custordersdetails"."insideodnote" IS 'Inside Order Details Note';
COMMENT ON COLUMN "custordersdetails"."unitpricestandard" IS 'UnitPrice Standard, as set';
COMMENT ON COLUMN "custordersdetails"."discountstandard" IS 'UnitPrice Standard, as set';
COMMENT ON COLUMN "custordersdetails"."measoflwq1" IS 'Lenght * Width *Quantity1';

-- CREATE INDEXES ...
CREATE INDEX "custordersdetails_barcode_idx" ON "custordersdetails" ("barcode");
CREATE INDEX "custordersdetails_custinvoicedetailid_idx" ON "custordersdetails" ("custordersdetailid");
CREATE INDEX "custordersdetails_custinvoiceid_idx" ON "custordersdetails" ("custordersid");
CREATE INDEX "custordersdetails_prevcustinvoiceiddet_idx" ON "custordersdetails" ("prevcustorderiddet");
ALTER TABLE "custordersdetails" ADD CONSTRAINT "custordersdetails_pkey" PRIMARY KEY ("custordersdetailid");
CREATE INDEX "custordersdetails_prodcode_idx" ON "custordersdetails" ("prodcode");
CREATE INDEX "custordersdetails_prodcodeno_idx" ON "custordersdetails" ("prodcodeno");
CREATE INDEX "custordersdetails_prodcodetxt_idx" ON "custordersdetails" ("prodcodetxt");
CREATE INDEX "custordersdetails_productid_idx" ON "custordersdetails" ("productid");

CREATE TABLE IF NOT EXISTS "custpaylinkinv"
 (
	"autoid"			SERIAL, 
	"custpayid"			INTEGER, 
	"custinvid"			INTEGER, 
	"noote"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "custpaylinkinv_autoid_idx" ON "custpaylinkinv" ("autoid");
CREATE UNIQUE INDEX "custpaylinkinv_custinvid_idx" ON "custpaylinkinv" ("custinvid");
CREATE INDEX "custpaylinkinv_custpayid_idx" ON "custpaylinkinv" ("custpayid");
ALTER TABLE "custpaylinkinv" ADD CONSTRAINT "custpaylinkinv_pkey" PRIMARY KEY ("autoid");

CREATE TABLE IF NOT EXISTS "custpaymonth"
 (
	"idda"			SERIAL, 
	"custid"			INTEGER, 
	"monthnames"			VARCHAR (220), 
	"note1"			VARCHAR (50), 
	"num1"			REAL
);

-- CREATE INDEXES ...
CREATE INDEX "custpaymonth_custid_idx" ON "custpaymonth" ("custid");
CREATE INDEX "custpaymonth_idda_idx" ON "custpaymonth" ("idda");
CREATE INDEX "custpaymonth_num1_idx" ON "custpaymonth" ("num1");
ALTER TABLE "custpaymonth" ADD CONSTRAINT "custpaymonth_pkey" PRIMARY KEY ("idda");

CREATE TABLE IF NOT EXISTS "custpricelist"
 (
	"custpricelistid"			SERIAL, 
	"codeid"			VARCHAR (50), 
	"invid"			INTEGER, 
	"custsup"			INTEGER, 
	"customerwsid"			INTEGER, 
	"custtype"			INTEGER, 
	"projectnameinv"			VARCHAR (150), 
	"account"			DOUBLE PRECISION, 
	"status"			VARCHAR (20), 
	"custinvoicedate"			DATE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"discountinv"			REAL, 
	"vatinv"			REAL, 
	"amountinv"			REAL, 
	"notes"			VARCHAR (250), 
	"dollarrate"			REAL, 
	"insideinote"			VARCHAR (200), 
	"currency"			VARCHAR (50), 
	"duedate"			DATE, 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"salesman"			INTEGER, 
	"prevcustinvoiceid"			INTEGER, 
	"tansref"			VARCHAR (50), 
	"validitydate"			VARCHAR (120), 
	"paymentterms"			VARCHAR (200), 
	"preparedby"			VARCHAR (70), 
	"gmsignature"			VARCHAR (100), 
	"ref"			VARCHAR (50), 
	"subjectq"			VARCHAR (120), 
	"department"			VARCHAR (50), 
	"projectduration"			VARCHAR (120), 
	"custproj"			INTEGER
);
COMMENT ON COLUMN "custpricelist"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';
COMMENT ON COLUMN "custpricelist"."insideinote" IS 'Inside Inv  Note';
COMMENT ON COLUMN "custpricelist"."salesman" IS 'ExReceipt';
COMMENT ON COLUMN "custpricelist"."gmsignature" IS 'General Manager Signature';

-- CREATE INDEXES ...
CREATE INDEX "custpricelist_codeid_idx" ON "custpricelist" ("codeid");
CREATE INDEX "custpricelist_customerid_idx" ON "custpricelist" ("customerwsid");
CREATE INDEX "custpricelist_employeeid_idx" ON "custpricelist" ("employeeid");
CREATE INDEX "custpricelist_invid_idx" ON "custpricelist" ("invid");
CREATE INDEX "custpricelist_jvid_idx" ON "custpricelist" ("jvid");
CREATE INDEX "custpricelist_prevcustinvoiceid_idx" ON "custpricelist" ("prevcustinvoiceid");
ALTER TABLE "custpricelist" ADD CONSTRAINT "custpricelist_pkey" PRIMARY KEY ("custpricelistid");

CREATE TABLE IF NOT EXISTS "custpricelistdetails"
 (
	"custpricelistdetailid"			SERIAL, 
	"custpricelistid"			INTEGER, 
	"productid"			INTEGER, 
	"prodcodeno"			INTEGER, 
	"prodcodetxt"			INTEGER, 
	"barcode"			INTEGER, 
	"unit"			INTEGER, 
	"jalekh"			BOOLEAN NOT NULL, 
	"shateb"			BOOLEAN NOT NULL, 
	"sand"			BOOLEAN NOT NULL, 
	"quantity"			REAL, 
	"lenght"			REAL, 
	"width"			REAL, 
	"meas"			REAL, 
	"uprice"			REAL, 
	"unitprice"			REAL, 
	"unitpricelbp"			REAL, 
	"initialprice"			REAL, 
	"discount"			REAL, 
	"note"			VARCHAR (150), 
	"sn1"			VARCHAR (50), 
	"sn2"			VARCHAR (50), 
	"orderid"			INTEGER, 
	"projectnamedet"			VARCHAR (50), 
	"check"			BOOLEAN NOT NULL, 
	"insideidnote"			VARCHAR (50), 
	"unitpricestandard"			REAL, 
	"discountstandard"			REAL, 
	"quantity1"			REAL, 
	"itemsaledate"			DATE, 
	"measoflwq1"			REAL, 
	"hidedetails1"			BOOLEAN NOT NULL, 
	"hidedetails2"			BOOLEAN NOT NULL, 
	"prevcustinvoiceiddet"			INTEGER
);
COMMENT ON COLUMN "custpricelistdetails"."jalekh" IS '--';
COMMENT ON COLUMN "custpricelistdetails"."shateb" IS '--';
COMMENT ON COLUMN "custpricelistdetails"."sand" IS '---------';
COMMENT ON COLUMN "custpricelistdetails"."insideidnote" IS 'Inside Inv Details Note';
COMMENT ON COLUMN "custpricelistdetails"."unitpricestandard" IS 'UnitPrice Standard, as set';
COMMENT ON COLUMN "custpricelistdetails"."discountstandard" IS 'UnitPrice Standard, as set';
COMMENT ON COLUMN "custpricelistdetails"."measoflwq1" IS 'Lenght * Width *Quantity1';

-- CREATE INDEXES ...
CREATE INDEX "custpricelistdetails_custinvoicedetailid_idx" ON "custpricelistdetails" ("custpricelistdetailid");
CREATE INDEX "custpricelistdetails_custinvoiceid_idx" ON "custpricelistdetails" ("custpricelistid");
CREATE INDEX "custpricelistdetails_orderid_idx" ON "custpricelistdetails" ("orderid");
CREATE INDEX "custpricelistdetails_prevcustinvid_idx" ON "custpricelistdetails" ("prevcustinvoiceiddet");
ALTER TABLE "custpricelistdetails" ADD CONSTRAINT "custpricelistdetails_pkey" PRIMARY KEY ("custpricelistdetailid");
CREATE INDEX "custpricelistdetails_prodcode_idx" ON "custpricelistdetails" ("barcode");
CREATE INDEX "custpricelistdetails_prodcodeno_idx" ON "custpricelistdetails" ("prodcodeno");
CREATE INDEX "custpricelistdetails_prodcodetxt_idx" ON "custpricelistdetails" ("prodcodetxt");
CREATE INDEX "custpricelistdetails_productid_idx" ON "custpricelistdetails" ("productid");

CREATE TABLE IF NOT EXISTS "custpricelistfactor"
 (
	"idd"			SERIAL, 
	"conamep"			VARCHAR (50), 
	"subjectq"			VARCHAR (120), 
	"validitydate"			VARCHAR (120), 
	"paymentterms"			TEXT, 
	"department"			VARCHAR (50), 
	"preparedby"			VARCHAR (100), 
	"gmsignature"			VARCHAR (50), 
	"projectduration"			VARCHAR (120)
);

-- CREATE INDEXES ...
CREATE INDEX "custpricelistfactor_idd_idx" ON "custpricelistfactor" ("idd");
ALTER TABLE "custpricelistfactor" ADD CONSTRAINT "custpricelistfactor_pkey" PRIMARY KEY ("idd");

CREATE TABLE IF NOT EXISTS "custsinvstock"
 (
	"custinvstockid"			SERIAL, 
	"codeid"			VARCHAR (50), 
	"invid"			INTEGER, 
	"custsup"			INTEGER, 
	"customerwsid"			INTEGER, 
	"custtype"			INTEGER, 
	"projectnameinv"			VARCHAR (50), 
	"account"			DOUBLE PRECISION, 
	"status"			VARCHAR (20), 
	"custinvstockdate"			DATE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"discountinv"			REAL, 
	"vatinv"			REAL, 
	"amountinv"			REAL, 
	"notes"			VARCHAR (50), 
	"dollarrate"			REAL, 
	"insideinote"			VARCHAR (200), 
	"currency"			VARCHAR (50), 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"salesman"			INTEGER, 
	"stockref"			INTEGER
);
COMMENT ON COLUMN "custsinvstock"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';
COMMENT ON COLUMN "custsinvstock"."insideinote" IS 'Inside Inv  Note';
COMMENT ON COLUMN "custsinvstock"."salesman" IS 'ExReceipt';

-- CREATE INDEXES ...
CREATE INDEX "custsinvstock_codeid_idx" ON "custsinvstock" ("codeid");
CREATE INDEX "custsinvstock_customerid_idx" ON "custsinvstock" ("customerwsid");
CREATE INDEX "custsinvstock_invid_idx" ON "custsinvstock" ("invid");
CREATE INDEX "custsinvstock_jvid_idx" ON "custsinvstock" ("jvid");
ALTER TABLE "custsinvstock" ADD CONSTRAINT "custsinvstock_pkey" PRIMARY KEY ("custinvstockid");

CREATE TABLE IF NOT EXISTS "custstock"
 (
	"idd"			SERIAL, 
	"csdate"			DATE, 
	"cstime"			TIMESTAMP WITHOUT TIME ZONE, 
	"cust"			INTEGER, 
	"prodid"			INTEGER, 
	"iniprice"			REAL, 
	"saleprice"			REAL, 
	"csqty"			REAL, 
	"note1"			VARCHAR (50), 
	"note2"			VARCHAR (50), 
	"codeid"			VARCHAR (50), 
	"stockref"			INTEGER, 
	"custstocktype"			INTEGER
);
COMMENT ON COLUMN "custstock"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "custstock_codeid_idx" ON "custstock" ("codeid");
CREATE INDEX "custstock_idd_idx" ON "custstock" ("idd");
ALTER TABLE "custstock" ADD CONSTRAINT "custstock_pkey" PRIMARY KEY ("idd");
CREATE INDEX "custstock_prodid_idx" ON "custstock" ("prodid");

CREATE TABLE IF NOT EXISTS "custstocktype"
 (
	"iddd"			SERIAL, 
	"custstocktypename"			VARCHAR (50), 
	"note1"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "custstocktype_iddd_idx" ON "custstocktype" ("iddd");
ALTER TABLE "custstocktype" ADD CONSTRAINT "custstocktype_pkey" PRIMARY KEY ("iddd");

CREATE TABLE IF NOT EXISTS "custtype"
 (
	"id"			SERIAL, 
	"custtype"			VARCHAR (50), 
	"discprofitpercent"			REAL
);

-- CREATE INDEXES ...
CREATE INDEX "custtype_id_idx" ON "custtype" ("id");
ALTER TABLE "custtype" ADD CONSTRAINT "custtype_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "custvempl"
 (
	"aid"			SERIAL, 
	"maincutdateid"			INTEGER, 
	"timesnowe"			TIMESTAMP WITHOUT TIME ZONE, 
	"worker"			INTEGER, 
	"note1"			VARCHAR (50), 
	"note2"			VARCHAR (50), 
	"timetype"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "custvempl_aid_idx" ON "custvempl" ("aid");
CREATE INDEX "custvempl_maincutdateid_idx" ON "custvempl" ("maincutdateid");
ALTER TABLE "custvempl" ADD CONSTRAINT "custvempl_pkey" PRIMARY KEY ("aid");

CREATE TABLE IF NOT EXISTS "dailyrecprintreport"
 (
	"autonum"			SERIAL, 
	"customerwsid"			INTEGER, 
	"custwholesalename"			VARCHAR (50), 
	"region"			INTEGER, 
	"billingaddress"			TEXT, 
	"phonenumber"			VARCHAR (30), 
	"worker"			INTEGER, 
	"receiptname"			VARCHAR (50), 
	"ddate"			DATE, 
	"timein"			TIMESTAMP WITHOUT TIME ZONE, 
	"timeout"			TIMESTAMP WITHOUT TIME ZONE, 
	"dddate"			TIMESTAMP WITHOUT TIME ZONE, 
	"dayname"			VARCHAR (50), 
	"regname"			VARCHAR (50), 
	"note1"			VARCHAR (200), 
	"wsaccount"			DOUBLE PRECISION, 
	"custtype"			INTEGER
);

-- CREATE INDEXES ...
CREATE INDEX "dailyrecprintreport_autonum_idx" ON "dailyrecprintreport" ("autonum");
CREATE INDEX "dailyrecprintreport_customerwsid_idx" ON "dailyrecprintreport" ("customerwsid");

CREATE TABLE IF NOT EXISTS "datachartendtimetable"
 (
	"autoidd"			SERIAL, 
	"iiddd"			INTEGER, 
	"customer"			INTEGER, 
	"worker"			INTEGER, 
	"chartdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"dddate"			TIMESTAMP WITHOUT TIME ZONE, 
	"fromtime"			TIMESTAMP WITHOUT TIME ZONE, 
	"totime"			TIMESTAMP WITHOUT TIME ZONE, 
	"cellnametotime"			VARCHAR (255)
);

-- CREATE INDEXES ...
CREATE INDEX "datachartendtimetable_autoid_idx" ON "datachartendtimetable" ("autoidd");
ALTER TABLE "datachartendtimetable" ADD CONSTRAINT "datachartendtimetable_pkey" PRIMARY KEY ("autoidd");

CREATE TABLE IF NOT EXISTS "datedaylist"
 (
	"idddd"			SERIAL, 
	"dddate"			TIMESTAMP WITHOUT TIME ZONE, 
	"dayname"			VARCHAR (50), 
	"statusname"			VARCHAR (50), 
	"dayamt"			REAL, 
	"daycostamt"			REAL
);

-- CREATE INDEXES ...
CREATE INDEX "datedaylist_idddd_idx" ON "datedaylist" ("idddd");
ALTER TABLE "datedaylist" ADD CONSTRAINT "datedaylist_pkey" PRIMARY KEY ("idddd");

CREATE TABLE IF NOT EXISTS "datescuststoping"
 (
	"autoidd"			SERIAL, 
	"maincutdateid"			INTEGER, 
	"customer"			INTEGER, 
	"worker"			INTEGER, 
	"stoppingdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"nooote"			VARCHAR (200)
);

-- CREATE INDEXES ...
CREATE INDEX "datescuststoping_maincutdateid_idx" ON "datescuststoping" ("maincutdateid");
ALTER TABLE "datescuststoping" ADD CONSTRAINT "datescuststoping_pkey" PRIMARY KEY ("autoidd");

CREATE TABLE IF NOT EXISTS "ddate"
 (
	"ddda"			SERIAL, 
	"dddate"			DATE
);

-- CREATE INDEXES ...
ALTER TABLE "ddate" ADD CONSTRAINT "ddate_pkey" PRIMARY KEY ("ddda");

CREATE TABLE IF NOT EXISTS "deliverynote"
 (
	"dnid"			SERIAL, 
	"dnno"			INTEGER NOT NULL, 
	"dnrefno"			INTEGER, 
	"orederno"			INTEGER, 
	"truckno"			VARCHAR (50), 
	"customerwsid"			INTEGER, 
	"account"			DOUBLE PRECISION, 
	"status"			VARCHAR (20), 
	"dndate"			DATE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"discountinv"			DOUBLE PRECISION, 
	"discountinveur"			DOUBLE PRECISION, 
	"vat"			REAL, 
	"vateur"			REAL, 
	"vatrate"			REAL, 
	"notes"			TEXT, 
	"dollarprice"			REAL, 
	"eurodollar"			REAL, 
	"currency"			VARCHAR (50), 
	"paymentterms"			VARCHAR (100), 
	"supref"			VARCHAR (50), 
	"salesman"			INTEGER, 
	"salescomm"			REAL, 
	"receiver"			INTEGER, 
	"employeeid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"stockref"			INTEGER
);
COMMENT ON COLUMN "deliverynote"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "deliverynote_codeid_idx" ON "deliverynote" ("codeid");
CREATE INDEX "deliverynote_customerid_idx" ON "deliverynote" ("customerwsid");
CREATE INDEX "deliverynote_employeeid_idx" ON "deliverynote" ("employeeid");
CREATE UNIQUE INDEX "deliverynote_invno_idx" ON "deliverynote" ("dnno");
ALTER TABLE "deliverynote" ADD CONSTRAINT "deliverynote_pkey" PRIMARY KEY ("dnid");

CREATE TABLE IF NOT EXISTS "deliverynotedetails"
 (
	"dndetailid"			SERIAL, 
	"dnid"			INTEGER, 
	"productid"			INTEGER, 
	"prodcode"			VARCHAR (50), 
	"unit"			VARCHAR (50), 
	"quantity"			REAL, 
	"lenght"			REAL, 
	"width"			REAL, 
	"meas"			REAL, 
	"meassymbol"			VARCHAR (15), 
	"amtrounded"			REAL, 
	"measnote"			VARCHAR (100), 
	"unitprice"			REAL, 
	"initialprice"			REAL, 
	"discount"			REAL, 
	"note"			VARCHAR (150), 
	"sn1"			VARCHAR (50), 
	"sn2"			VARCHAR (50), 
	"print"			BOOLEAN NOT NULL, 
	"insideodnote"			VARCHAR (50), 
	"roundmeas"			BOOLEAN NOT NULL, 
	"measup"			VARCHAR (50), 
	"containerid1"			INTEGER, 
	"containerid2"			INTEGER, 
	"stockref"			INTEGER
);
COMMENT ON COLUMN "deliverynotedetails"."insideodnote" IS 'Inside Order Details Note';

-- CREATE INDEXES ...
CREATE INDEX "deliverynotedetails_containerid_idx" ON "deliverynotedetails" ("containerid1");
CREATE INDEX "deliverynotedetails_containerid1_idx" ON "deliverynotedetails" ("containerid2");
CREATE INDEX "deliverynotedetails_custinvoicedetailid_idx" ON "deliverynotedetails" ("dndetailid");
CREATE INDEX "deliverynotedetails_custinvoiceid_idx" ON "deliverynotedetails" ("dnid");
ALTER TABLE "deliverynotedetails" ADD CONSTRAINT "deliverynotedetails_pkey" PRIMARY KEY ("dndetailid");
CREATE INDEX "deliverynotedetails_prodcode_idx" ON "deliverynotedetails" ("prodcode");
CREATE INDEX "deliverynotedetails_productid_idx" ON "deliverynotedetails" ("productid");

CREATE TABLE IF NOT EXISTS "dollarprice"
 (
	"dollarprice"			INTEGER, 
	"eurusd"			REAL, 
	"purcurusdrate"			REAL
);

-- CREATE INDEXES ...

CREATE TABLE IF NOT EXISTS "drawer"
 (
	"id"			SERIAL, 
	"date"			TIMESTAMP WITHOUT TIME ZONE, 
	"type"			VARCHAR (50), 
	"inamtll"			INTEGER, 
	"inamtusd"			REAL, 
	"inname"			INTEGER, 
	"inrecp"			VARCHAR (50), 
	"intype"			INTEGER, 
	"innote"			VARCHAR (75), 
	"outamtll"			INTEGER, 
	"outamtusd"			REAL, 
	"outrecp"			VARCHAR (50), 
	"outname"			INTEGER, 
	"outtype"			INTEGER, 
	"outnote"			VARCHAR (75)
);

-- CREATE INDEXES ...
CREATE INDEX "drawer_id_idx" ON "drawer" ("id");
ALTER TABLE "drawer" ADD CONSTRAINT "drawer_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "employeeposition"
 (
	"pid"			SERIAL, 
	"position"			VARCHAR (50), 
	"rate"			INTEGER
);

-- CREATE INDEXES ...
CREATE INDEX "employeeposition_id_idx" ON "employeeposition" ("pid");
ALTER TABLE "employeeposition" ADD CONSTRAINT "employeeposition_pkey" PRIMARY KEY ("pid");

CREATE TABLE IF NOT EXISTS "employees"
 (
	"employeeid"			SERIAL, 
	"name"			VARCHAR (50), 
	"emailname"			VARCHAR (50), 
	"address"			VARCHAR (255), 
	"birthdate"			DATE, 
	"datehired"			DATE, 
	"salary"			NUMERIC(15,2), 
	"hourrate"			DOUBLE PRECISION, 
	"billingrate"			NUMERIC(15,2), 
	"deductions"			INTEGER, 
	"supervisorid"			INTEGER, 
	"account"			DOUBLE PRECISION, 
	"pay"			DOUBLE PRECISION, 
	"rec"			DOUBLE PRECISION, 
	"notes"			TEXT, 
	"active"			BOOLEAN NOT NULL, 
	"position"			VARCHAR (50), 
	"aaccount"			INTEGER, 
	"aaccid"			INTEGER
);

-- CREATE INDEXES ...
CREATE INDEX "employees_aaccid_idx" ON "employees" ("aaccid");
CREATE INDEX "employees_emailname_idx" ON "employees" ("emailname");
CREATE UNIQUE INDEX "employees_name_idx" ON "employees" ("name");
ALTER TABLE "employees" ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("employeeid");
CREATE INDEX "employees_supervisorid_idx" ON "employees" ("supervisorid");

CREATE TABLE IF NOT EXISTS "emppayment"
 (
	"id"			SERIAL, 
	"employeeid"			INTEGER, 
	"paymentvalue"			REAL, 
	"datep"			TIMESTAMP WITHOUT TIME ZONE, 
	"notep"			VARCHAR (50), 
	"transfer"			BOOLEAN NOT NULL, 
	"approval"			BOOLEAN NOT NULL, 
	"closebalannceamt"			REAL, 
	"paycond"			VARCHAR (50), 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50)
);
COMMENT ON COLUMN "emppayment"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "emppayment_codeid_idx" ON "emppayment" ("codeid");
CREATE INDEX "emppayment_employeeid_idx" ON "emppayment" ("employeeid");
CREATE INDEX "emppayment_id_idx" ON "emppayment" ("id");
CREATE INDEX "emppayment_jvid_idx" ON "emppayment" ("jvid");
ALTER TABLE "emppayment" ADD CONSTRAINT "emppayment_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "empstatement"
 (
	"id"			SERIAL, 
	"date"			TIMESTAMP WITHOUT TIME ZONE, 
	"employee"			INTEGER, 
	"projectid"			INTEGER, 
	"workplace"			INTEGER, 
	"workinghrs"			REAL, 
	"ratehr"			REAL, 
	"amount"			REAL, 
	"payment"			REAL, 
	"closebalancefright"			REAL, 
	"note"			VARCHAR (50), 
	"balance"			REAL
);

-- CREATE INDEXES ...
CREATE INDEX "empstatement_id_idx" ON "empstatement" ("id");
ALTER TABLE "empstatement" ADD CONSTRAINT "empstatement_pkey" PRIMARY KEY ("id");
CREATE INDEX "empstatement_projectid_idx" ON "empstatement" ("projectid");
CREATE INDEX "empstatement_projectid1_idx" ON "empstatement" ("workplace");

CREATE TABLE IF NOT EXISTS "exchangetran"
 (
	"id"			SERIAL, 
	"branch"			VARCHAR (50), 
	"exchdate"			TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	"exchtime"			TIMESTAMP WITHOUT TIME ZONE, 
	"ref"			VARCHAR (50), 
	"exchtype"			VARCHAR (50), 
	"dollarrate"			REAL, 
	"lbpamt"			REAL NOT NULL, 
	"usdamt"			REAL NOT NULL, 
	"lbpamtsign"			REAL NOT NULL, 
	"usdamtsign"			REAL NOT NULL, 
	"note"			VARCHAR (150), 
	"employeeid"			INTEGER, 
	"systemdollarrate"			REAL
);

-- CREATE INDEXES ...
CREATE INDEX "exchangetran_employeeid_idx" ON "exchangetran" ("employeeid");
CREATE INDEX "exchangetran_id_idx" ON "exchangetran" ("id");
ALTER TABLE "exchangetran" ADD CONSTRAINT "exchangetran_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "exptypecat"
 (
	"exptypecat"			VARCHAR (50), 
	"desc"			VARCHAR (50)
);

-- CREATE INDEXES ...

CREATE TABLE IF NOT EXISTS "exreceipt"
 (
	"receiptid"			SERIAL, 
	"namef"			VARCHAR (50), 
	"receiptname"			VARCHAR (50), 
	"jobtype"			VARCHAR (50), 
	"phone"			VARCHAR (50), 
	"address"			VARCHAR (50), 
	"datehired"			DATE, 
	"salary"			REAL, 
	"position"			VARCHAR (50), 
	"note"			VARCHAR (80), 
	"commrate"			REAL, 
	"aaccount"			INTEGER, 
	"aaccid"			INTEGER, 
	"aaccountmainid"			INTEGER, 
	"stopingdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"activeemployee"			VARCHAR (50), 
	"stockref"			INTEGER, 
	"salaryusd"			REAL, 
	"salarylbp"			REAL
);
COMMENT ON COLUMN "exreceipt"."stopingdate" IS 'incase of employee';

-- CREATE INDEXES ...
CREATE INDEX "exreceipt_aaccid_idx" ON "exreceipt" ("aaccid");
CREATE INDEX "exreceipt_aaccountmainid_idx" ON "exreceipt" ("aaccountmainid");
CREATE INDEX "exreceipt_id_idx" ON "exreceipt" ("receiptid");
CREATE INDEX "exreceipt_position_idx" ON "exreceipt" ("position");
ALTER TABLE "exreceipt" ADD CONSTRAINT "exreceipt_pkey" PRIMARY KEY ("receiptid");

CREATE TABLE IF NOT EXISTS "extype"
 (
	"id"			SERIAL, 
	"expensetype"			VARCHAR (50), 
	"expenseacc"			INTEGER, 
	"note"			VARCHAR (50), 
	"typecat"			VARCHAR (50), 
	"aaccount"			INTEGER, 
	"aaccid"			INTEGER, 
	"aaccountmainid"			INTEGER, 
	"type4acc"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "extype_aaccid_idx" ON "extype" ("aaccid");
CREATE INDEX "extype_aaccountmainid_idx" ON "extype" ("aaccountmainid");
CREATE INDEX "extype_id_idx" ON "extype" ("id");
ALTER TABLE "extype" ADD CONSTRAINT "extype_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "generalledger"
 (
	"lid"			SERIAL, 
	"glno"			INTEGER, 
	"ldate"			DATE, 
	"ltime"			TIMESTAMP WITHOUT TIME ZONE, 
	"mainaccnumber"			INTEGER, 
	"accnumber"			INTEGER, 
	"refid"			INTEGER, 
	"refno"			INTEGER, 
	"reftxt"			VARCHAR (50), 
	"refperson"			VARCHAR (50), 
	"description"			VARCHAR (100), 
	"debit"			REAL, 
	"credit"			REAL, 
	"balance"			REAL, 
	"currency"			VARCHAR (20), 
	"usdlbprate"			REAL, 
	"eurusdrate"			REAL, 
	"amtlbp"			REAL, 
	"amtusd"			REAL, 
	"amteur"			REAL, 
	"amtequivalent"			REAL, 
	"note"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "generalledger_lid_idx" ON "generalledger" ("lid");
ALTER TABLE "generalledger" ADD CONSTRAINT "generalledger_pkey" PRIMARY KEY ("lid");
CREATE INDEX "generalledger_refid_idx" ON "generalledger" ("refid");

CREATE TABLE IF NOT EXISTS "imeidata"
 (
	"idddd"			SERIAL, 
	"imeno"			VARCHAR (50), 
	"prodid"			INTEGER, 
	"inrefdate"			DATE, 
	"inref"			VARCHAR (50), 
	"inclientid"			INTEGER, 
	"inclientname"			VARCHAR (50), 
	"intype"			VARCHAR (50), 
	"inid"			INTEGER, 
	"iniddet"			INTEGER, 
	"indatetime"			TIMESTAMP WITHOUT TIME ZONE, 
	"innote1"			VARCHAR (50), 
	"outrefdate"			DATE, 
	"outref"			VARCHAR (50), 
	"outclientid"			INTEGER, 
	"outclientname"			VARCHAR (50), 
	"outtype"			VARCHAR (50), 
	"outid"			INTEGER, 
	"outiddet"			INTEGER, 
	"outdatetime"			TIMESTAMP WITHOUT TIME ZONE, 
	"outnote"			VARCHAR (50), 
	"note1"			VARCHAR (50), 
	"num1"			INTEGER, 
	"num2"			INTEGER, 
	"date1"			TIMESTAMP WITHOUT TIME ZONE, 
	"date2"			TIMESTAMP WITHOUT TIME ZONE
);
COMMENT ON COLUMN "imeidata"."prodid" IS '-----------------';
COMMENT ON COLUMN "imeidata"."inrefdate" IS 'IN';
COMMENT ON COLUMN "imeidata"."innote1" IS '------------';
COMMENT ON COLUMN "imeidata"."outrefdate" IS 'Out';
COMMENT ON COLUMN "imeidata"."outnote" IS '------------';

-- CREATE INDEXES ...
CREATE INDEX "imeidata_idddd_idx" ON "imeidata" ("idddd");
CREATE INDEX "imeidata_inclientid_idx" ON "imeidata" ("inclientid");
CREATE INDEX "imeidata_indetid_idx" ON "imeidata" ("outiddet");
CREATE INDEX "imeidata_num1_idx" ON "imeidata" ("num1");
CREATE INDEX "imeidata_num2_idx" ON "imeidata" ("num2");
CREATE INDEX "imeidata_outclientid_idx" ON "imeidata" ("outclientid");
ALTER TABLE "imeidata" ADD CONSTRAINT "imeidata_pkey" PRIMARY KEY ("idddd");
CREATE INDEX "imeidata_prodid_idx" ON "imeidata" ("prodid");
CREATE INDEX "imeidata_purdetid_idx" ON "imeidata" ("iniddet");
CREATE INDEX "imeidata_purid_idx" ON "imeidata" ("inid");
CREATE INDEX "imeidata_saleid_idx" ON "imeidata" ("outid");

CREATE TABLE IF NOT EXISTS "infodetails"
 (
	"id"			SERIAL, 
	"infoname"			VARCHAR (50), 
	"head1ar"			VARCHAR (50), 
	"head2ar"			VARCHAR (50), 
	"head3ar"			VARCHAR (50), 
	"head4ar"			VARCHAR (50), 
	"head5ar"			VARCHAR (50), 
	"head1en"			VARCHAR (50), 
	"head2en"			VARCHAR (50), 
	"head3en"			VARCHAR (50), 
	"head4en"			VARCHAR (50), 
	"head5en"			VARCHAR (50), 
	"footer1ar"			VARCHAR (150), 
	"footer2ar"			VARCHAR (150), 
	"footer3ar"			VARCHAR (150), 
	"footer1en"			VARCHAR (150), 
	"footer2en"			VARCHAR (150), 
	"footer3en"			VARCHAR (150)
);

-- CREATE INDEXES ...
CREATE INDEX "infodetails_id_idx" ON "infodetails" ("id");
ALTER TABLE "infodetails" ADD CONSTRAINT "infodetails_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "invamount"
 (
	"id"			SERIAL, 
	"amt"			REAL
);

-- CREATE INDEXES ...
CREATE INDEX "invamount_id_idx" ON "invamount" ("id");
ALTER TABLE "invamount" ADD CONSTRAINT "invamount_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "inventorydet"
 (
	"inventdetailid"			SERIAL, 
	"inventid"			INTEGER, 
	"barcode"			INTEGER, 
	"barcodet"			VARCHAR (50), 
	"productid"			INTEGER, 
	"productname"			VARCHAR (250), 
	"prevstock"			REAL, 
	"curstock"			REAL, 
	"quantity"			REAL, 
	"unitofmeas"			INTEGER, 
	"unitprice"			DOUBLE PRECISION, 
	"initialprice"			DOUBLE PRECISION, 
	"discount"			REAL NOT NULL, 
	"paymentterms"			VARCHAR (255), 
	"sn1"			VARCHAR (50), 
	"sn2"			VARCHAR (50), 
	"timein"			TIMESTAMP WITHOUT TIME ZONE, 
	"entered"			BOOLEAN NOT NULL, 
	"stockref"			INTEGER, 
	"proddate"			DATE
);
COMMENT ON COLUMN "inventorydet"."prevstock" IS '*************   Add  at 21/1/2017';
COMMENT ON COLUMN "inventorydet"."curstock" IS '*************   Add  at 21/1/2017';

-- CREATE INDEXES ...
CREATE INDEX "inventorydet_barcode_idx" ON "inventorydet" ("barcode");
CREATE INDEX "inventorydet_custinvoiceid_idx" ON "inventorydet" ("inventid");
ALTER TABLE "inventorydet" ADD CONSTRAINT "inventorydet_pkey" PRIMARY KEY ("inventdetailid");
CREATE INDEX "inventorydet_productid_idx" ON "inventorydet" ("productid");

CREATE TABLE IF NOT EXISTS "inventorymain"
 (
	"inventid"			SERIAL, 
	"inventno"			INTEGER, 
	"employeeid"			INTEGER, 
	"account"			REAL, 
	"status"			VARCHAR (20), 
	"inventdate"			DATE, 
	"inventtime"			TIMESTAMP WITHOUT TIME ZONE, 
	"dollarrate"			REAL, 
	"notes"			VARCHAR (50), 
	"paid"			BOOLEAN NOT NULL, 
	"currency1"			INTEGER, 
	"delivery"			VARCHAR (50), 
	"transstatus"			INTEGER, 
	"stockref"			INTEGER
);

-- CREATE INDEXES ...
CREATE INDEX "inventorymain_employeeid_idx" ON "inventorymain" ("employeeid");
ALTER TABLE "inventorymain" ADD CONSTRAINT "inventorymain_pkey" PRIMARY KEY ("inventid");

CREATE TABLE IF NOT EXISTS "invoice details"
 (
	"invoicedetailid"			SERIAL, 
	"invoiceid"			INTEGER, 
	"productid"			INTEGER, 
	"barcode"			INTEGER, 
	"prodcodeno"			INTEGER, 
	"prodcodetxt"			INTEGER, 
	"unit"			INTEGER, 
	"box"			REAL, 
	"quantity"			DOUBLE PRECISION, 
	"lenght"			REAL, 
	"width"			REAL, 
	"meas"			REAL, 
	"price"			DOUBLE PRECISION, 
	"discount"			DOUBLE PRECISION, 
	"vat"			REAL, 
	"sn1"			VARCHAR (50), 
	"sn2"			VARCHAR (50), 
	"pricing"			BOOLEAN NOT NULL, 
	"insideidnote"			VARCHAR (50), 
	"purprice"			DOUBLE PRECISION, 
	"purcurrrate"			DOUBLE PRECISION, 
	"expenpercent1"			REAL, 
	"expenfixed1"			REAL, 
	"expenpercent2"			REAL, 
	"expenfixed2"			REAL, 
	"previnvoiceiddet"			INTEGER, 
	"stockb4"			REAL, 
	"initialpriceb4"			REAL, 
	"priceb4"			DOUBLE PRECISION, 
	"discountb4"			DOUBLE PRECISION, 
	"expenpercent1b4"			REAL, 
	"expenfixed1b4"			REAL, 
	"expenpercent2b4"			REAL, 
	"expenfixed2b4"			REAL, 
	"stockref"			INTEGER, 
	"proddate"			DATE, 
	"purdetcreatedate"			TIMESTAMP WITHOUT TIME ZONE, 
	"purdetstatusname"			VARCHAR (50), 
	"purdetstatusdate"			TIMESTAMP WITHOUT TIME ZONE
);
COMMENT ON COLUMN "invoice details"."insideidnote" IS 'Inside Inv Details Note';
COMMENT ON COLUMN "invoice details"."stockb4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoice details"."initialpriceb4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoice details"."priceb4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoice details"."discountb4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoice details"."expenpercent1b4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoice details"."expenfixed1b4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoice details"."expenpercent2b4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoice details"."expenfixed2b4" IS 'For Cumulative Price calculation';

-- CREATE INDEXES ...
CREATE INDEX "invoice details_invoiceid_idx" ON "invoice details" ("invoiceid");
CREATE INDEX "invoice details_previnvoiceid_idx" ON "invoice details" ("previnvoiceiddet");
ALTER TABLE "invoice details" ADD CONSTRAINT "invoice details_pkey" PRIMARY KEY ("invoicedetailid");
CREATE INDEX "invoice details_prodcode_idx" ON "invoice details" ("barcode");
CREATE INDEX "invoice details_prodcodeno_idx" ON "invoice details" ("prodcodeno");
CREATE INDEX "invoice details_prodcodetxt_idx" ON "invoice details" ("prodcodetxt");
CREATE INDEX "invoice details_productid_idx" ON "invoice details" ("productid");

CREATE TABLE IF NOT EXISTS "invoicedetailpre1"
 (
	"invoicedetailid"			SERIAL, 
	"invoiceid"			INTEGER, 
	"productid"			INTEGER, 
	"barcode"			INTEGER, 
	"prodcodeno"			INTEGER, 
	"prodcodetxt"			INTEGER, 
	"unit"			INTEGER, 
	"box"			REAL, 
	"quantity"			DOUBLE PRECISION, 
	"lenght"			REAL, 
	"width"			REAL, 
	"meas"			REAL, 
	"price"			DOUBLE PRECISION, 
	"discount"			DOUBLE PRECISION, 
	"vat"			REAL, 
	"sn1"			VARCHAR (50), 
	"sn2"			VARCHAR (50), 
	"pricing"			BOOLEAN NOT NULL, 
	"insideidnote"			VARCHAR (50), 
	"purprice"			DOUBLE PRECISION, 
	"purcurrrate"			DOUBLE PRECISION, 
	"expenpercent1"			REAL, 
	"expenfixed1"			REAL, 
	"expenpercent2"			REAL, 
	"expenfixed2"			REAL, 
	"previnvoiceiddet"			INTEGER, 
	"stockb4"			REAL, 
	"initialpriceb4"			REAL, 
	"priceb4"			DOUBLE PRECISION, 
	"discountb4"			DOUBLE PRECISION, 
	"expenpercent1b4"			REAL, 
	"expenfixed1b4"			REAL, 
	"expenpercent2b4"			REAL, 
	"expenfixed2b4"			REAL, 
	"stockref"			INTEGER, 
	"proddate"			TIMESTAMP WITHOUT TIME ZONE
);
COMMENT ON COLUMN "invoicedetailpre1"."insideidnote" IS 'Inside Inv Details Note';
COMMENT ON COLUMN "invoicedetailpre1"."stockb4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoicedetailpre1"."initialpriceb4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoicedetailpre1"."priceb4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoicedetailpre1"."discountb4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoicedetailpre1"."expenpercent1b4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoicedetailpre1"."expenfixed1b4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoicedetailpre1"."expenpercent2b4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoicedetailpre1"."expenfixed2b4" IS 'For Cumulative Price calculation';

-- CREATE INDEXES ...
CREATE INDEX "invoicedetailpre1_barcode_idx" ON "invoicedetailpre1" ("barcode");
CREATE INDEX "invoicedetailpre1_invoiceid_idx" ON "invoicedetailpre1" ("invoiceid");
CREATE INDEX "invoicedetailpre1_previnvoiceiddet_idx" ON "invoicedetailpre1" ("previnvoiceiddet");
ALTER TABLE "invoicedetailpre1" ADD CONSTRAINT "invoicedetailpre1_pkey" PRIMARY KEY ("invoicedetailid");
CREATE INDEX "invoicedetailpre1_prodcodeno_idx" ON "invoicedetailpre1" ("prodcodeno");
CREATE INDEX "invoicedetailpre1_prodcodetxt_idx" ON "invoicedetailpre1" ("prodcodetxt");
CREATE INDEX "invoicedetailpre1_productid_idx" ON "invoicedetailpre1" ("productid");

CREATE TABLE IF NOT EXISTS "invoicepre"
 (
	"invoiceid"			SERIAL, 
	"supinvoiceno"			VARCHAR (50), 
	"supplierid"			INTEGER, 
	"invoicedate"			DATE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"notes"			VARCHAR (50), 
	"invdiscount"			DOUBLE PRECISION, 
	"dollarrate"			REAL, 
	"amountinv"			REAL, 
	"invvat"			REAL, 
	"insideinote"			VARCHAR (50), 
	"currency"			VARCHAR (50), 
	"purcurrency"			VARCHAR (50), 
	"purcurrrate"			DOUBLE PRECISION, 
	"expenpercent1"			REAL, 
	"expenfixed1"			REAL, 
	"expenpercent2"			REAL, 
	"expenfixed2"			REAL, 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"previnvoiceid"			INTEGER, 
	"status"			VARCHAR (20), 
	"stockref"			INTEGER
);
COMMENT ON COLUMN "invoicepre"."invvat" IS 'VAT %';
COMMENT ON COLUMN "invoicepre"."insideinote" IS 'Inside Inv Note';
COMMENT ON COLUMN "invoicepre"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "invoicepre_codeid_idx" ON "invoicepre" ("codeid");
CREATE INDEX "invoicepre_employeeid_idx" ON "invoicepre" ("employeeid");
CREATE INDEX "invoicepre_jvid_idx" ON "invoicepre" ("jvid");
CREATE INDEX "invoicepre_previnvoiceid_idx" ON "invoicepre" ("previnvoiceid");
ALTER TABLE "invoicepre" ADD CONSTRAINT "invoicepre_pkey" PRIMARY KEY ("invoiceid");
CREATE INDEX "invoicepre_supplierid_idx" ON "invoicepre" ("supplierid");

CREATE TABLE IF NOT EXISTS "invoicepre1"
 (
	"invoiceid"			SERIAL, 
	"supinvoiceno"			VARCHAR (50), 
	"supplierid"			INTEGER, 
	"invoicedate"			DATE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"notes"			VARCHAR (50), 
	"invdiscount"			DOUBLE PRECISION, 
	"dollarrate"			REAL, 
	"amountinv"			REAL, 
	"invvat"			REAL, 
	"insideinote"			VARCHAR (50), 
	"currency"			VARCHAR (50), 
	"purcurrency"			VARCHAR (50), 
	"purcurrrate"			DOUBLE PRECISION, 
	"expenpercent1"			REAL, 
	"expenfixed1"			REAL, 
	"expenpercent2"			REAL, 
	"expenfixed2"			REAL, 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"previnvoiceid"			INTEGER, 
	"status"			VARCHAR (20), 
	"stockref"			INTEGER
);
COMMENT ON COLUMN "invoicepre1"."invvat" IS 'VAT %';
COMMENT ON COLUMN "invoicepre1"."insideinote" IS 'Inside Inv Note';
COMMENT ON COLUMN "invoicepre1"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "invoicepre1_codeid_idx" ON "invoicepre1" ("codeid");
CREATE INDEX "invoicepre1_employeeid_idx" ON "invoicepre1" ("employeeid");
CREATE INDEX "invoicepre1_jvid_idx" ON "invoicepre1" ("jvid");
CREATE INDEX "invoicepre1_previnvoiceid_idx" ON "invoicepre1" ("previnvoiceid");
ALTER TABLE "invoicepre1" ADD CONSTRAINT "invoicepre1_pkey" PRIMARY KEY ("invoiceid");
CREATE INDEX "invoicepre1_supplierid_idx" ON "invoicepre1" ("supplierid");

CREATE TABLE IF NOT EXISTS "invoices"
 (
	"invoiceid"			SERIAL, 
	"supinvoiceno"			VARCHAR (50), 
	"supplierid"			INTEGER, 
	"invoicedate"			DATE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"notes"			VARCHAR (50), 
	"invdiscount"			DOUBLE PRECISION, 
	"dollarrate"			REAL, 
	"amountinv"			REAL, 
	"invvat"			REAL, 
	"insideinote"			VARCHAR (50), 
	"currency"			VARCHAR (50), 
	"purcurrency"			VARCHAR (50), 
	"purcurrrate"			DOUBLE PRECISION, 
	"expenpercent1"			REAL, 
	"expenfixed1"			REAL, 
	"expenpercent2"			REAL, 
	"expenfixed2"			REAL, 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"previnvoiceid"			INTEGER, 
	"status"			VARCHAR (20), 
	"stockref"			INTEGER
);
COMMENT ON COLUMN "invoices"."invvat" IS 'VAT %';
COMMENT ON COLUMN "invoices"."insideinote" IS 'Inside Inv Note';
COMMENT ON COLUMN "invoices"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "invoices_codeid_idx" ON "invoices" ("codeid");
CREATE INDEX "invoices_employeeid_idx" ON "invoices" ("employeeid");
CREATE INDEX "invoices_jvid_idx" ON "invoices" ("jvid");
CREATE INDEX "invoices_previnvoiceid_idx" ON "invoices" ("previnvoiceid");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("invoiceid");
CREATE INDEX "invoices_supplierid_idx" ON "invoices" ("supplierid");

CREATE TABLE IF NOT EXISTS "invtempcal"
 (
	"id"			SERIAL, 
	"ref"			INTEGER, 
	"nameid"			INTEGER, 
	"amt1"			REAL, 
	"amt2"			REAL, 
	"disc"			REAL, 
	"vat"			REAL
);

-- CREATE INDEXES ...
CREATE INDEX "invtempcal_id_idx" ON "invtempcal" ("id");
ALTER TABLE "invtempcal" ADD CONSTRAINT "invtempcal_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "jovomain"
 (
	"jvidauto"			SERIAL, 
	"jvid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"employeeid"			INTEGER, 
	"jvno"			INTEGER, 
	"jvnomonth"			INTEGER, 
	"jvdate"			DATE, 
	"jvtime"			TIMESTAMP WITHOUT TIME ZONE, 
	"jvcurrency"			VARCHAR (50), 
	"usdlbprate"			REAL, 
	"eurusdrate"			REAL, 
	"tranid"			INTEGER, 
	"trano"			INTEGER, 
	"traref"			VARCHAR (50), 
	"tratype"			VARCHAR (50), 
	"tradate"			DATE, 
	"tratime"			TIMESTAMP WITHOUT TIME ZONE, 
	"tracurrency"			VARCHAR (50), 
	"clienttype"			VARCHAR (50), 
	"clientid"			INTEGER, 
	"clientno"			INTEGER, 
	"clientname"			VARCHAR (50), 
	"description1"			VARCHAR (100), 
	"description2"			VARCHAR (100), 
	"jvamount"			REAL, 
	"note"			VARCHAR (75), 
	"dateappend"			DATE, 
	"timeappend"			TIMESTAMP WITHOUT TIME ZONE
);
COMMENT ON COLUMN "jovomain"."tranid" IS 'Transaction';

-- CREATE INDEXES ...
CREATE INDEX "jovomain_clientid_idx" ON "jovomain" ("clientid");
CREATE INDEX "jovomain_employeeid_idx" ON "jovomain" ("employeeid");
CREATE INDEX "jovomain_jvid_idx" ON "jovomain" ("jvidauto");
CREATE INDEX "jovomain_jvid1_idx" ON "jovomain" ("jvid");
ALTER TABLE "jovomain" ADD CONSTRAINT "jovomain_pkey" PRIMARY KEY ("jvidauto");
CREATE INDEX "jovomain_tranid_idx" ON "jovomain" ("tranid");

CREATE TABLE IF NOT EXISTS "jvmain"
 (
	"jvid"			SERIAL, 
	"jvno"			INTEGER, 
	"jvnomonth"			INTEGER, 
	"jvdate"			DATE, 
	"jvtime"			TIMESTAMP WITHOUT TIME ZONE, 
	"jvcurrency"			VARCHAR (50), 
	"usdlbprate"			REAL, 
	"eurusdrate"			REAL, 
	"tranid"			INTEGER, 
	"trano"			INTEGER, 
	"traref"			VARCHAR (50), 
	"tratype"			VARCHAR (50), 
	"tradate"			DATE, 
	"tratime"			TIMESTAMP WITHOUT TIME ZONE, 
	"tracurrency"			VARCHAR (50), 
	"clienttype"			VARCHAR (50), 
	"clientid"			INTEGER, 
	"clientno"			INTEGER, 
	"clientname"			VARCHAR (50), 
	"description1"			VARCHAR (100), 
	"description2"			VARCHAR (100), 
	"jvamount"			REAL, 
	"note"			VARCHAR (75)
);
COMMENT ON COLUMN "jvmain"."tranid" IS 'Transaction';

-- CREATE INDEXES ...
CREATE INDEX "jvmain_clientid_idx" ON "jvmain" ("clientid");
CREATE INDEX "jvmain_jvid_idx" ON "jvmain" ("jvid");
ALTER TABLE "jvmain" ADD CONSTRAINT "jvmain_pkey" PRIMARY KEY ("jvid");
CREATE INDEX "jvmain_tranid_idx" ON "jvmain" ("tranid");

CREATE TABLE IF NOT EXISTS "jvmainfirst"
 (
	"jvid"			SERIAL, 
	"jvno"			INTEGER, 
	"jvnomonth"			INTEGER, 
	"jvdate"			DATE, 
	"jvtime"			TIMESTAMP WITHOUT TIME ZONE, 
	"jvcurrency"			VARCHAR (50), 
	"usdlbprate"			REAL, 
	"eurusdrate"			REAL, 
	"tranid"			INTEGER, 
	"trano"			INTEGER, 
	"traref"			VARCHAR (50), 
	"tratype"			VARCHAR (50), 
	"tradate"			DATE, 
	"tratime"			TIMESTAMP WITHOUT TIME ZONE, 
	"tracurrency"			VARCHAR (50), 
	"clienttype"			VARCHAR (50), 
	"clientid"			INTEGER, 
	"clientno"			INTEGER, 
	"clientname"			VARCHAR (50), 
	"description1"			VARCHAR (100), 
	"description2"			VARCHAR (100), 
	"jvamount"			REAL, 
	"note"			VARCHAR (75), 
	"dateappend"			DATE, 
	"timeappend"			TIMESTAMP WITHOUT TIME ZONE
);
COMMENT ON COLUMN "jvmainfirst"."tranid" IS 'Transaction';

-- CREATE INDEXES ...
CREATE INDEX "jvmainfirst_clientid_idx" ON "jvmainfirst" ("clientid");
CREATE INDEX "jvmainfirst_jvid_idx" ON "jvmainfirst" ("jvid");
ALTER TABLE "jvmainfirst" ADD CONSTRAINT "jvmainfirst_pkey" PRIMARY KEY ("jvid");
CREATE INDEX "jvmainfirst_tranid_idx" ON "jvmainfirst" ("tranid");

CREATE TABLE IF NOT EXISTS "jvsub"
 (
	"jvsid"			SERIAL, 
	"jvid"			INTEGER, 
	"aaccountnomain"			INTEGER, 
	"aaccountno"			INTEGER, 
	"aaccountid"			INTEGER, 
	"aaccountname"			VARCHAR (50), 
	"curr"			VARCHAR (50), 
	"amtlbp"			REAL, 
	"amtusd"			REAL, 
	"amt"			REAL, 
	"usdlbprate"			REAL, 
	"eurusdrate"			REAL, 
	"description"			VARCHAR (100), 
	"debitamt"			REAL, 
	"creditamt"			REAL, 
	"note"			VARCHAR (100), 
	"debitamt2cur"			REAL, 
	"creditamt2cur"			REAL
);
COMMENT ON COLUMN "jvsub"."debitamt2cur" IS '2nd Currency';
COMMENT ON COLUMN "jvsub"."creditamt2cur" IS '2nd Currency';

-- CREATE INDEXES ...
CREATE INDEX "jvsub_aaccountid_idx" ON "jvsub" ("aaccountid");
CREATE INDEX "jvsub_jvid_idx" ON "jvsub" ("jvid");
CREATE INDEX "jvsub_jvsid_idx" ON "jvsub" ("jvsid");
ALTER TABLE "jvsub" ADD CONSTRAINT "jvsub_pkey" PRIMARY KEY ("jvsid");

CREATE TABLE IF NOT EXISTS "language"
 (
	"id"			SERIAL, 
	"language"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "language_id_idx" ON "language" ("id");
ALTER TABLE "language" ADD CONSTRAINT "language_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "level"
 (
	"id"			SERIAL, 
	"level"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "level_id_idx" ON "level" ("id");
ALTER TABLE "level" ADD CONSTRAINT "level_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "levelingproddet"
 (
	"levelingdetid"			SERIAL, 
	"levelingid"			INTEGER, 
	"productid"			INTEGER, 
	"barcode"			INTEGER, 
	"prodcodeno"			INTEGER, 
	"prodcodetxt"			INTEGER, 
	"unit"			INTEGER, 
	"iniprice"			DOUBLE PRECISION, 
	"inicurrency"			VARCHAR (50), 
	"saleprice"			DOUBLE PRECISION, 
	"salecurrency"			VARCHAR (50), 
	"currentstock"			DOUBLE PRECISION, 
	"realstock"			DOUBLE PRECISION, 
	"levelingqty"			DOUBLE PRECISION, 
	"insideidnote"			VARCHAR (50), 
	"stockref"			INTEGER, 
	"proddate"			DATE
);
COMMENT ON COLUMN "levelingproddet"."insideidnote" IS 'Inside  Note';

-- CREATE INDEXES ...
CREATE INDEX "levelingproddet_invoiceid_idx" ON "levelingproddet" ("levelingid");
ALTER TABLE "levelingproddet" ADD CONSTRAINT "levelingproddet_pkey" PRIMARY KEY ("levelingdetid");
CREATE INDEX "levelingproddet_prodcode_idx" ON "levelingproddet" ("barcode");
CREATE INDEX "levelingproddet_prodcodeno_idx" ON "levelingproddet" ("prodcodeno");
CREATE INDEX "levelingproddet_prodcodetxt_idx" ON "levelingproddet" ("prodcodetxt");
CREATE INDEX "levelingproddet_productid_idx" ON "levelingproddet" ("productid");

CREATE TABLE IF NOT EXISTS "loginaccounts"
 (
	"id"			SERIAL, 
	"username"			INTEGER, 
	"position"			VARCHAR (50), 
	"level"			VARCHAR (50), 
	"password"			VARCHAR (50), 
	"loged"			BOOLEAN NOT NULL, 
	"custfr"			BOOLEAN NOT NULL, 
	"suppliersfr"			BOOLEAN NOT NULL, 
	"productsfr"			BOOLEAN NOT NULL, 
	"daystatementfr"			BOOLEAN NOT NULL, 
	"accountsfr"			BOOLEAN NOT NULL, 
	"employeesfr"			BOOLEAN NOT NULL, 
	"expensesfr"			BOOLEAN NOT NULL, 
	"reportfr"			BOOLEAN NOT NULL, 
	"dollarratefr"			BOOLEAN NOT NULL, 
	"passwordfr"			BOOLEAN NOT NULL, 
	"stocklevel"			BOOLEAN NOT NULL, 
	"salesfr"			BOOLEAN NOT NULL, 
	"mobilecallsfr"			BOOLEAN NOT NULL, 
	"intcallsfr"			BOOLEAN NOT NULL, 
	"westrenunionfr"			BOOLEAN NOT NULL, 
	"dhlfr"			BOOLEAN NOT NULL, 
	"editsaleinv"			BOOLEAN NOT NULL
);

-- CREATE INDEXES ...
CREATE INDEX "loginaccounts_id_idx" ON "loginaccounts" ("id");
ALTER TABLE "loginaccounts" ADD CONSTRAINT "loginaccounts_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "loginaccounts_username_idx" ON "loginaccounts" ("username");

CREATE TABLE IF NOT EXISTS "maincusdatedett"
 (
	"idddd"			SERIAL, 
	"maincutdateid"			INTEGER, 
	"timesnowdet"			TIMESTAMP WITHOUT TIME ZONE, 
	"dayssse"			INTEGER, 
	"fromdate"			DATE, 
	"todate"			DATE, 
	"fromtime"			TIMESTAMP WITHOUT TIME ZONE, 
	"totime"			TIMESTAMP WITHOUT TIME ZONE, 
	"note1"			VARCHAR (120), 
	"note2"			VARCHAR (120)
);

-- CREATE INDEXES ...
CREATE INDEX "maincusdatedett_idddd_idx" ON "maincusdatedett" ("idddd");
CREATE INDEX "maincusdatedett_maincutdateid_idx" ON "maincusdatedett" ("maincutdateid");
ALTER TABLE "maincusdatedett" ADD CONSTRAINT "maincusdatedett_pkey" PRIMARY KEY ("idddd");

CREATE TABLE IF NOT EXISTS "maincustdate"
 (
	"maincutdateid"			SERIAL, 
	"datesref"			VARCHAR (50), 
	"dateofdates"			DATE, 
	"timesnow"			TIMESTAMP WITHOUT TIME ZONE, 
	"customer"			INTEGER, 
	"rateee"			INTEGER, 
	"fromdate"			DATE, 
	"todate"			DATE, 
	"fromtime"			TIMESTAMP WITHOUT TIME ZONE, 
	"totime"			TIMESTAMP WITHOUT TIME ZONE, 
	"note"			VARCHAR (200), 
	"noteinternal"			VARCHAR (200)
);

-- CREATE INDEXES ...
CREATE INDEX "maincustdate_iddddd_idx" ON "maincustdate" ("maincutdateid");
ALTER TABLE "maincustdate" ADD CONSTRAINT "maincustdate_pkey" PRIMARY KEY ("maincutdateid");

CREATE TABLE IF NOT EXISTS "memotable"
 (
	"id"			SERIAL, 
	"infoname"			VARCHAR (50), 
	"text01"			TEXT, 
	"text02"			TEXT, 
	"text03"			TEXT, 
	"text04"			TEXT, 
	"text05"			TEXT, 
	"text06"			TEXT, 
	"text07"			TEXT, 
	"text08"			TEXT
);

-- CREATE INDEXES ...
CREATE INDEX "memotable_id_idx" ON "memotable" ("id");
ALTER TABLE "memotable" ADD CONSTRAINT "memotable_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "moneyflowstatement"
 (
	"id"			SERIAL, 
	"accid"			INTEGER, 
	"clientid"			INTEGER, 
	"clienttype"			VARCHAR (50), 
	"clientname"			VARCHAR (50), 
	"clientname2"			VARCHAR (50), 
	"mfdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"mftime"			TIMESTAMP WITHOUT TIME ZONE, 
	"tratype"			VARCHAR (50), 
	"traautoid"			INTEGER, 
	"traid"			INTEGER, 
	"trarefno"			VARCHAR (50), 
	"usdin"			DOUBLE PRECISION, 
	"lbpin"			DOUBLE PRECISION, 
	"totalin"			DOUBLE PRECISION, 
	"usdout"			DOUBLE PRECISION, 
	"lbpout"			DOUBLE PRECISION, 
	"totalout"			DOUBLE PRECISION, 
	"paymentmethod"			INTEGER, 
	"toacc"			INTEGER, 
	"accnow"			REAL, 
	"currency"			VARCHAR (50), 
	"exchangerate"			REAL, 
	"checkno"			VARCHAR (50), 
	"checkdate"			DATE, 
	"checkbankname"			VARCHAR (50), 
	"vdate"			DATE, 
	"codeid"			VARCHAR (50), 
	"salesman"			INTEGER, 
	"employeeid"			INTEGER, 
	"note1"			VARCHAR (70), 
	"note2"			VARCHAR (70)
);
COMMENT ON COLUMN "moneyflowstatement"."tratype" IS 'Inv, Pay , CN , ..';
COMMENT ON COLUMN "moneyflowstatement"."vdate" IS 'Value Date';
COMMENT ON COLUMN "moneyflowstatement"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';
COMMENT ON COLUMN "moneyflowstatement"."salesman" IS 'ExReceipt';
COMMENT ON COLUMN "moneyflowstatement"."employeeid" IS 'it wasnt add unless it mentioned at Note Word file';

-- CREATE INDEXES ...
CREATE INDEX "moneyflowstatement_accid_idx" ON "moneyflowstatement" ("accid");
CREATE INDEX "moneyflowstatement_clientid_idx" ON "moneyflowstatement" ("clienttype");
CREATE INDEX "moneyflowstatement_clientname_idx" ON "moneyflowstatement" ("clientname2");
CREATE INDEX "moneyflowstatement_clienttype_idx" ON "moneyflowstatement" ("clientname");
CREATE INDEX "moneyflowstatement_codeid_idx" ON "moneyflowstatement" ("codeid");
CREATE INDEX "moneyflowstatement_employeeid_idx" ON "moneyflowstatement" ("employeeid");
CREATE INDEX "moneyflowstatement_id_idx" ON "moneyflowstatement" ("id");
CREATE INDEX "moneyflowstatement_invoiceid_idx" ON "moneyflowstatement" ("traid");
ALTER TABLE "moneyflowstatement" ADD CONSTRAINT "moneyflowstatement_pkey" PRIMARY KEY ("id");
CREATE INDEX "moneyflowstatement_refidin1_idx" ON "moneyflowstatement" ("traautoid");
CREATE INDEX "moneyflowstatement_supplierid_idx" ON "moneyflowstatement" ("clientid");
CREATE INDEX "moneyflowstatement_traid_idx" ON "moneyflowstatement" ("trarefno");

CREATE TABLE IF NOT EXISTS "orderdetails"
 (
	"orderdetailid"			SERIAL, 
	"orderid"			INTEGER, 
	"productid"			INTEGER, 
	"quantity"			REAL, 
	"unitprice"			REAL, 
	"discount"			REAL, 
	"saleprice"			REAL, 
	"salestax"			REAL, 
	"linetotal"			REAL
);

-- CREATE INDEXES ...
CREATE INDEX "orderdetails_orderid_idx" ON "orderdetails" ("orderid");
ALTER TABLE "orderdetails" ADD CONSTRAINT "orderdetails_pkey" PRIMARY KEY ("orderdetailid");
CREATE INDEX "orderdetails_productid_idx" ON "orderdetails" ("productid");

CREATE TABLE IF NOT EXISTS "orders"
 (
	"orderid"			SERIAL, 
	"customerid"			INTEGER, 
	"orderdate"			DATE, 
	"purchaseordernumber"			VARCHAR (30), 
	"requiredbydate"			DATE, 
	"shipname"			VARCHAR (50), 
	"shipaddress"			VARCHAR (255), 
	"shipcity"			VARCHAR (50), 
	"shipphonenumber"			VARCHAR (30), 
	"shipdate"			DATE, 
	"shippingmethodid"			INTEGER
);

-- CREATE INDEXES ...
CREATE INDEX "orders_customerid_idx" ON "orders" ("customerid");
CREATE INDEX "orders_orderdate_idx" ON "orders" ("orderdate");
ALTER TABLE "orders" ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("orderid");
CREATE INDEX "orders_shipname_idx" ON "orders" ("shipname");
CREATE INDEX "orders_shippingmethodid_idx" ON "orders" ("shippingmethodid");

CREATE TABLE IF NOT EXISTS "packingmain"
 (
	"packid"			SERIAL, 
	"packno"			INTEGER, 
	"pdate"			DATE, 
	"ptime"			TIMESTAMP WITHOUT TIME ZONE, 
	"prodmainid"			INTEGER, 
	"qtymain"			REAL, 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"mnote"			VARCHAR (50), 
	"codeid"			VARCHAR (50), 
	"stockref"			INTEGER
);
COMMENT ON COLUMN "packingmain"."trans2acc" IS '!!!!!';
COMMENT ON COLUMN "packingmain"."jvid" IS '!!!!!';
COMMENT ON COLUMN "packingmain"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "packingmain_codeid_idx" ON "packingmain" ("codeid");
CREATE INDEX "packingmain_employeeid_idx" ON "packingmain" ("employeeid");
CREATE INDEX "packingmain_jvid_idx" ON "packingmain" ("jvid");
CREATE INDEX "packingmain_packid_idx" ON "packingmain" ("packid");
ALTER TABLE "packingmain" ADD CONSTRAINT "packingmain_pkey" PRIMARY KEY ("packid");
CREATE INDEX "packingmain_prodid_idx" ON "packingmain" ("prodmainid");

CREATE TABLE IF NOT EXISTS "packingsub"
 (
	"packsubid"			SERIAL, 
	"packid"			INTEGER, 
	"prodsubid"			INTEGER, 
	"qtysub"			REAL, 
	"snote"			VARCHAR (50), 
	"stockref"			INTEGER, 
	"prodqty"			REAL, 
	"factor"			REAL, 
	"subprodqty"			REAL, 
	"subprodunitmain"			INTEGER, 
	"subprodunitsecod"			INTEGER, 
	"unitcoef"			DOUBLE PRECISION, 
	"inipricesubprod"			REAL
);
COMMENT ON COLUMN "packingsub"."prodqty" IS 'NNNN';
COMMENT ON COLUMN "packingsub"."factor" IS 'NNNN';
COMMENT ON COLUMN "packingsub"."subprodqty" IS 'NNNN';
COMMENT ON COLUMN "packingsub"."subprodunitmain" IS 'NNNN';
COMMENT ON COLUMN "packingsub"."subprodunitsecod" IS 'NNNN';
COMMENT ON COLUMN "packingsub"."unitcoef" IS 'NNNN';
COMMENT ON COLUMN "packingsub"."inipricesubprod" IS 'NNNN';

-- CREATE INDEXES ...
CREATE INDEX "packingsub_packid_idx" ON "packingsub" ("packid");
CREATE INDEX "packingsub_packsubid_idx" ON "packingsub" ("packsubid");
ALTER TABLE "packingsub" ADD CONSTRAINT "packingsub_pkey" PRIMARY KEY ("packsubid");
CREATE INDEX "packingsub_prodmainid_idx" ON "packingsub" ("prodsubid");

CREATE TABLE IF NOT EXISTS "pagenamecap"
 (
	"captionid"			SERIAL, 
	"pagename"			VARCHAR (50), 
	"pagecaption"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "pagenamecap_captionid_idx" ON "pagenamecap" ("captionid");
ALTER TABLE "pagenamecap" ADD CONSTRAINT "pagenamecap_pkey" PRIMARY KEY ("captionid");

CREATE TABLE IF NOT EXISTS "password"
 (
	"id"			SERIAL, 
	"password"			VARCHAR (50), 
	"pwlogin"			VARCHAR (50), 
	"pwloginadmin"			VARCHAR (50), 
	"pwnow"			VARCHAR (50), 
	"deletionpass"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "password_id_idx" ON "password" ("id");
ALTER TABLE "password" ADD CONSTRAINT "password_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "paste errors"
 (
	"vatrate"			REAL
);

-- CREATE INDEXES ...

CREATE TABLE IF NOT EXISTS "paymentmethods"
 (
	"id"			SERIAL, 
	"paymentmethod"			VARCHAR (50), 
	"note"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "paymentmethods_id_idx" ON "paymentmethods" ("id");
ALTER TABLE "paymentmethods" ADD CONSTRAINT "paymentmethods_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "payments"
 (
	"paymentid"			SERIAL, 
	"payid"			INTEGER, 
	"payno"			INTEGER, 
	"refno"			INTEGER, 
	"invno"			INTEGER, 
	"customerid"			INTEGER, 
	"paymentamount"			DOUBLE PRECISION, 
	"dollar"			DOUBLE PRECISION, 
	"ll"			REAL, 
	"toaccount"			INTEGER, 
	"dollarrate"			DOUBLE PRECISION, 
	"paymentdate"			DATE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"paymentmethod"			INTEGER, 
	"checknumber"			VARCHAR (50), 
	"bank"			VARCHAR (50), 
	"checkdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"checkpass"			VARCHAR (50), 
	"paymentterms"			VARCHAR (255), 
	"notes"			VARCHAR (150), 
	"checkstransref"			INTEGER, 
	"vatrate"			REAL, 
	"salesman"			INTEGER, 
	"salescomm"			REAL, 
	"currency"			VARCHAR (50), 
	"valuedate"			DATE, 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"status"			VARCHAR (50), 
	"duedate"			VARCHAR (50), 
	"notesmonth"			VARCHAR (50), 
	"tansref"			VARCHAR (50), 
	"custproj"			INTEGER, 
	"toaaccount"			INTEGER NOT NULL, 
	"paycreatedate"			TIMESTAMP WITHOUT TIME ZONE, 
	"paystatusname"			VARCHAR (50), 
	"paystatusdate"			TIMESTAMP WITHOUT TIME ZONE
);
COMMENT ON COLUMN "payments"."toaccount" IS 'From Customer Payment';
COMMENT ON COLUMN "payments"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';
COMMENT ON COLUMN "payments"."toaaccount" IS 'To  Acc Paid From Cust  (Cash , Bank ,... )  not Personal acc';

-- CREATE INDEXES ...
CREATE INDEX "payments_checknumber_idx" ON "payments" ("checknumber");
CREATE INDEX "payments_checknumber1_idx" ON "payments" ("bank");
CREATE INDEX "payments_codeid_idx" ON "payments" ("codeid");
CREATE INDEX "payments_customerid_idx" ON "payments" ("customerid");
CREATE INDEX "payments_employeeid_idx" ON "payments" ("employeeid");
CREATE INDEX "payments_jvid_idx" ON "payments" ("jvid");
CREATE INDEX "payments_payid_idx" ON "payments" ("payid");
CREATE INDEX "payments_paymentid_idx" ON "payments" ("paymentid");
CREATE INDEX "payments_payno_idx" ON "payments" ("payno");
ALTER TABLE "payments" ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("paymentid");

CREATE TABLE IF NOT EXISTS "paymentsdetails"
 (
	"paydetid"			SERIAL, 
	"paymentid"			INTEGER, 
	"paymentamount"			DOUBLE PRECISION, 
	"currency"			VARCHAR (50), 
	"usd"			DOUBLE PRECISION, 
	"lbp"			DOUBLE PRECISION, 
	"eur"			DOUBLE PRECISION, 
	"toaccount"			INTEGER, 
	"dollarrate"			DOUBLE PRECISION, 
	"dollarrateout"			DOUBLE PRECISION, 
	"paydettime"			TIMESTAMP WITHOUT TIME ZONE, 
	"paymentmethod"			VARCHAR (50), 
	"checknumber"			VARCHAR (50), 
	"bank"			VARCHAR (50), 
	"checkdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"checkpass"			VARCHAR (50), 
	"notes"			VARCHAR (150), 
	"checkstransref"			INTEGER, 
	"duedate"			DATE, 
	"transfer"			BOOLEAN NOT NULL, 
	"transferdestination"			VARCHAR (50)
);
COMMENT ON COLUMN "paymentsdetails"."toaccount" IS 'From Customer Payment';

-- CREATE INDEXES ...
CREATE INDEX "paymentsdetails_bank_idx" ON "paymentsdetails" ("bank");
CREATE INDEX "paymentsdetails_checknumber_idx" ON "paymentsdetails" ("checknumber");
CREATE INDEX "paymentsdetails_paydetid_idx" ON "paymentsdetails" ("paydetid");
CREATE INDEX "paymentsdetails_paymentid_idx" ON "paymentsdetails" ("paymentid");
ALTER TABLE "paymentsdetails" ADD CONSTRAINT "paymentsdetails_pkey" PRIMARY KEY ("paydetid");

CREATE TABLE IF NOT EXISTS "paymentsdetails yyy"
 (
	"paydetid"			SERIAL, 
	"paymentid"			INTEGER, 
	"paymentamount"			DOUBLE PRECISION, 
	"currency"			VARCHAR (50), 
	"usd"			DOUBLE PRECISION, 
	"lbp"			DOUBLE PRECISION, 
	"eur"			DOUBLE PRECISION, 
	"toaccount"			INTEGER, 
	"dollarrate"			DOUBLE PRECISION, 
	"dollarrateout"			DOUBLE PRECISION, 
	"paydettime"			TIMESTAMP WITHOUT TIME ZONE, 
	"paymentmethod"			VARCHAR (50), 
	"checknumber"			VARCHAR (50), 
	"bank"			VARCHAR (50), 
	"checkdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"checkpass"			VARCHAR (50), 
	"notes"			VARCHAR (150), 
	"checkstransref"			INTEGER, 
	"duedate"			DATE, 
	"transfer"			BOOLEAN NOT NULL, 
	"transferdestination"			VARCHAR (50)
);
COMMENT ON COLUMN "paymentsdetails yyy"."toaccount" IS 'From Customer Payment';

-- CREATE INDEXES ...
CREATE INDEX "paymentsdetails yyy_bank_idx" ON "paymentsdetails yyy" ("bank");
CREATE INDEX "paymentsdetails yyy_checknumber_idx" ON "paymentsdetails yyy" ("checknumber");
CREATE INDEX "paymentsdetails yyy_paydetid_idx" ON "paymentsdetails yyy" ("paydetid");
CREATE INDEX "paymentsdetails yyy_paymentid_idx" ON "paymentsdetails yyy" ("paymentid");
ALTER TABLE "paymentsdetails yyy" ADD CONSTRAINT "paymentsdetails yyy_pkey" PRIMARY KEY ("paydetid");

CREATE TABLE IF NOT EXISTS "postouchno"
 (
	"id"			SERIAL, 
	"touchfno"			INTEGER
);

-- CREATE INDEXES ...
CREATE INDEX "postouchno_id_idx" ON "postouchno" ("id");
CREATE INDEX "postouchno_nummm_idx" ON "postouchno" ("touchfno");
ALTER TABLE "postouchno" ADD CONSTRAINT "postouchno_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "preacc"
 (
	"id"			SERIAL, 
	"preacc"			DOUBLE PRECISION, 
	"preaccequiv"			DOUBLE PRECISION
);

-- CREATE INDEXES ...
CREATE INDEX "preacc_id_idx" ON "preacc" ("id");
ALTER TABLE "preacc" ADD CONSTRAINT "preacc_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "proddatereflist"
 (
	"iddd"			SERIAL, 
	"prodid"			INTEGER, 
	"proddate"			DATE, 
	"ref1"			VARCHAR (50), 
	"num1"			INTEGER, 
	"prodin"			REAL, 
	"prodout"			REAL, 
	"prodstock"			REAL, 
	"typeee"			VARCHAR (50), 
	"stockref"			INTEGER
);

-- CREATE INDEXES ...
CREATE INDEX "proddatereflist_iddd_idx" ON "proddatereflist" ("iddd");
CREATE INDEX "proddatereflist_num1_idx" ON "proddatereflist" ("num1");
ALTER TABLE "proddatereflist" ADD CONSTRAINT "proddatereflist_pkey" PRIMARY KEY ("iddd");
CREATE INDEX "proddatereflist_prodid_idx" ON "proddatereflist" ("prodid");

CREATE TABLE IF NOT EXISTS "proddatereflist2"
 (
	"iddd"			SERIAL, 
	"prodid"			INTEGER, 
	"proddate"			TIMESTAMP WITHOUT TIME ZONE, 
	"prodprevyear"			REAL, 
	"prodin"			REAL, 
	"prodout"			REAL, 
	"prodstock"			REAL, 
	"stockref"			INTEGER
);

-- CREATE INDEXES ...
CREATE INDEX "proddatereflist2_iddd_idx" ON "proddatereflist2" ("iddd");
ALTER TABLE "proddatereflist2" ADD CONSTRAINT "proddatereflist2_pkey" PRIMARY KEY ("iddd");
CREATE INDEX "proddatereflist2_prodid1_idx" ON "proddatereflist2" ("prodid");

CREATE TABLE IF NOT EXISTS "proddatereflistprevyear"
 (
	"iddd"			SERIAL, 
	"prodid"			INTEGER, 
	"proddate"			TIMESTAMP WITHOUT TIME ZONE, 
	"prodin"			REAL, 
	"prodout"			REAL, 
	"prodstock"			REAL, 
	"stockref"			INTEGER
);

-- CREATE INDEXES ...
CREATE INDEX "proddatereflistprevyear_iddd_idx" ON "proddatereflistprevyear" ("iddd");
ALTER TABLE "proddatereflistprevyear" ADD CONSTRAINT "proddatereflistprevyear_pkey" PRIMARY KEY ("iddd");
CREATE INDEX "proddatereflistprevyear_prodid_idx" ON "proddatereflistprevyear" ("prodid");

CREATE TABLE IF NOT EXISTS "proditemlink"
 (
	"id"			SERIAL, 
	"productid"			INTEGER, 
	"prodqty"			REAL, 
	"subprod"			INTEGER, 
	"factor"			REAL, 
	"subprodqty"			REAL
);

-- CREATE INDEXES ...
CREATE INDEX "proditemlink_id_idx" ON "proditemlink" ("id");
CREATE INDEX "proditemlink_itemid_idx" ON "proditemlink" ("subprod");
ALTER TABLE "proditemlink" ADD CONSTRAINT "proditemlink_pkey" PRIMARY KEY ("id");
CREATE INDEX "proditemlink_productid_idx" ON "proditemlink" ("productid");

CREATE TABLE IF NOT EXISTS "prodqtystate1"
 (
	"id"			SERIAL, 
	"prodid"			INTEGER, 
	"tradate"			TIMESTAMP WITHOUT TIME ZONE, 
	"tratime"			TIMESTAMP WITHOUT TIME ZONE, 
	"tratype"			VARCHAR (50), 
	"traid"			INTEGER, 
	"traref"			VARCHAR (50), 
	"traqtyin"			REAL, 
	"traqtyout"			REAL, 
	"note"			VARCHAR (70), 
	"prodqtynow"			REAL, 
	"stockref"			INTEGER, 
	"proddate"			DATE
);
COMMENT ON COLUMN "prodqtystate1"."tratype" IS 'Sale, Return , Purchase , ....';

-- CREATE INDEXES ...
CREATE INDEX "prodqtystate1_id_idx" ON "prodqtystate1" ("id");
CREATE INDEX "prodqtystate1_invoiceid_idx" ON "prodqtystate1" ("traid");
ALTER TABLE "prodqtystate1" ADD CONSTRAINT "prodqtystate1_pkey" PRIMARY KEY ("id");
CREATE INDEX "prodqtystate1_supplierid_idx" ON "prodqtystate1" ("prodid");
CREATE INDEX "prodqtystate1_traid_idx" ON "prodqtystate1" ("traref");

CREATE TABLE IF NOT EXISTS "prodqtystate2"
 (
	"id"			SERIAL, 
	"prodid"			INTEGER, 
	"tradate"			TIMESTAMP WITHOUT TIME ZONE, 
	"tratime"			TIMESTAMP WITHOUT TIME ZONE, 
	"tratype"			VARCHAR (50), 
	"traid"			INTEGER, 
	"traref"			VARCHAR (50), 
	"traqtyin"			REAL, 
	"traqtyout"			REAL, 
	"note"			VARCHAR (70), 
	"prodqtynow"			REAL, 
	"stockref"			INTEGER, 
	"proddate"			DATE
);
COMMENT ON COLUMN "prodqtystate2"."tratype" IS 'Sale, Return , Purchase , ....';

-- CREATE INDEXES ...
CREATE INDEX "prodqtystate2_id_idx" ON "prodqtystate2" ("id");
CREATE INDEX "prodqtystate2_invoiceid_idx" ON "prodqtystate2" ("traid");
ALTER TABLE "prodqtystate2" ADD CONSTRAINT "prodqtystate2_pkey" PRIMARY KEY ("id");
CREATE INDEX "prodqtystate2_supplierid_idx" ON "prodqtystate2" ("prodid");
CREATE INDEX "prodqtystate2_traid_idx" ON "prodqtystate2" ("traref");

CREATE TABLE IF NOT EXISTS "prodqtystatement"
 (
	"id"			SERIAL, 
	"productid"			INTEGER, 
	"date"			TIMESTAMP WITHOUT TIME ZONE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"type"			VARCHAR (50), 
	"traautoid"			INTEGER, 
	"instockref"			VARCHAR (50), 
	"instockqty"			DOUBLE PRECISION, 
	"outstockref"			VARCHAR (50), 
	"outstockqty"			DOUBLE PRECISION, 
	"stocknow"			REAL, 
	"clientname"			VARCHAR (50), 
	"clientid"			INTEGER, 
	"note"			VARCHAR (70), 
	"codeid"			VARCHAR (50), 
	"stockref"			INTEGER, 
	"proddate"			DATE, 
	"custproj"			INTEGER
);
COMMENT ON COLUMN "prodqtystatement"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "prodqtystatement_clientid_idx" ON "prodqtystatement" ("clientid");
CREATE INDEX "prodqtystatement_codeid_idx" ON "prodqtystatement" ("codeid");
CREATE INDEX "prodqtystatement_id_idx" ON "prodqtystatement" ("id");
CREATE INDEX "prodqtystatement_instockref_idx" ON "prodqtystatement" ("instockref");
CREATE INDEX "prodqtystatement_outstockref_idx" ON "prodqtystatement" ("outstockref");
ALTER TABLE "prodqtystatement" ADD CONSTRAINT "prodqtystatement_pkey" PRIMARY KEY ("id");
CREATE INDEX "prodqtystatement_supplierid_idx" ON "prodqtystatement" ("productid");
CREATE INDEX "prodqtystatement_traautoid_idx" ON "prodqtystatement" ("traautoid");

CREATE TABLE IF NOT EXISTS "prodqtystatement1st"
 (
	"id"			SERIAL, 
	"productid"			INTEGER, 
	"date"			TIMESTAMP WITHOUT TIME ZONE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"type"			VARCHAR (50), 
	"traautoid"			INTEGER, 
	"instockref"			VARCHAR (50), 
	"instockqty"			DOUBLE PRECISION, 
	"outstockref"			VARCHAR (50), 
	"outstockqty"			DOUBLE PRECISION, 
	"stocknow"			REAL, 
	"clientname"			VARCHAR (50), 
	"clientid"			INTEGER, 
	"note"			VARCHAR (70), 
	"codeid"			VARCHAR (50), 
	"stockref"			INTEGER, 
	"proddate"			DATE, 
	"custproj"			INTEGER
);
COMMENT ON COLUMN "prodqtystatement1st"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "prodqtystatement1st_clientid_idx" ON "prodqtystatement1st" ("clientid");
CREATE INDEX "prodqtystatement1st_codeid_idx" ON "prodqtystatement1st" ("codeid");
CREATE INDEX "prodqtystatement1st_id_idx" ON "prodqtystatement1st" ("id");
CREATE INDEX "prodqtystatement1st_invoiceid_idx" ON "prodqtystatement1st" ("instockref");
CREATE INDEX "prodqtystatement1st_paymentid_idx" ON "prodqtystatement1st" ("outstockref");
ALTER TABLE "prodqtystatement1st" ADD CONSTRAINT "prodqtystatement1st_pkey" PRIMARY KEY ("id");
CREATE INDEX "prodqtystatement1st_supplierid_idx" ON "prodqtystatement1st" ("productid");
CREATE INDEX "prodqtystatement1st_traautoid_idx" ON "prodqtystatement1st" ("traautoid");

CREATE TABLE IF NOT EXISTS "prodstockqtytable"
 (
	"iddddd"			SERIAL, 
	"productid"			INTEGER, 
	"stockref"			INTEGER, 
	"qtyyy"			REAL, 
	"notee"			VARCHAR (50), 
	"custid"			INTEGER, 
	"custidb"			INTEGER, 
	"ddate"			DATE
);

-- CREATE INDEXES ...
CREATE INDEX "prodstockqtytable_custid_idx" ON "prodstockqtytable" ("custid");
CREATE INDEX "prodstockqtytable_custidb_idx" ON "prodstockqtytable" ("custidb");
CREATE INDEX "prodstockqtytable_iddddd_idx" ON "prodstockqtytable" ("iddddd");
ALTER TABLE "prodstockqtytable" ADD CONSTRAINT "prodstockqtytable_pkey" PRIMARY KEY ("iddddd");
CREATE INDEX "prodstockqtytable_productid_idx" ON "prodstockqtytable" ("productid");

CREATE TABLE IF NOT EXISTS "production"
 (
	"proid"			SERIAL, 
	"codeid"			VARCHAR (50), 
	"prono"			INTEGER, 
	"prodate"			DATE, 
	"protime"			TIMESTAMP WITHOUT TIME ZONE, 
	"exreceipt"			INTEGER, 
	"customerwsid"			INTEGER, 
	"projectnamepro"			VARCHAR (50), 
	"amountprod"			REAL, 
	"notes"			VARCHAR (50), 
	"dollarrate"			REAL, 
	"insideinote"			VARCHAR (200), 
	"currency"			VARCHAR (50), 
	"duedate"			DATE, 
	"employeeid"			INTEGER, 
	"salesman"			INTEGER, 
	"calced"			VARCHAR (50), 
	"qtyed"			VARCHAR (50), 
	"delivery"			VARCHAR (50), 
	"stockref"			INTEGER
);
COMMENT ON COLUMN "production"."proid" IS 'Production ID';
COMMENT ON COLUMN "production"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';
COMMENT ON COLUMN "production"."customerwsid" IS 'can be used to whcih Customer';
COMMENT ON COLUMN "production"."projectnamepro" IS 'can be used to whcih Project';
COMMENT ON COLUMN "production"."insideinote" IS 'Inside Inv  Note';
COMMENT ON COLUMN "production"."salesman" IS 'ExReceipt';

-- CREATE INDEXES ...
CREATE INDEX "production_codeid_idx" ON "production" ("codeid");
CREATE INDEX "production_customerwsid_idx" ON "production" ("customerwsid");
CREATE INDEX "production_employeeid_idx" ON "production" ("employeeid");
CREATE INDEX "production_invid_idx" ON "production" ("prono");
ALTER TABLE "production" ADD CONSTRAINT "production_pkey" PRIMARY KEY ("proid");
CREATE INDEX "production_prodid_idx" ON "production" ("proid");

CREATE TABLE IF NOT EXISTS "productionformulaprod"
 (
	"id"			SERIAL, 
	"productid"			INTEGER, 
	"subprod"			INTEGER, 
	"prodqty"			REAL, 
	"factor"			REAL, 
	"subprodqty"			REAL, 
	"subprodunitmain"			INTEGER, 
	"subprodunitsecod"			INTEGER, 
	"unitcoef"			DOUBLE PRECISION, 
	"inipricesubprod"			REAL
);

-- CREATE INDEXES ...
CREATE INDEX "productionformulaprod_id_idx" ON "productionformulaprod" ("id");
CREATE INDEX "productionformulaprod_itemid_idx" ON "productionformulaprod" ("subprod");
ALTER TABLE "productionformulaprod" ADD CONSTRAINT "productionformulaprod_pkey" PRIMARY KEY ("id");
CREATE INDEX "productionformulaprod_productid_idx" ON "productionformulaprod" ("productid");

CREATE TABLE IF NOT EXISTS "productlist"
 (
	"pidlist"			SERIAL, 
	"barcode"			VARCHAR (50), 
	"productname"			VARCHAR (100) NOT NULL, 
	"category"			INTEGER NOT NULL, 
	"price"			REAL NOT NULL, 
	"discount"			REAL NOT NULL, 
	"initialprice"			REAL NOT NULL, 
	"unitprice"			REAL NOT NULL, 
	"minunitprice"			REAL NOT NULL
);
COMMENT ON COLUMN "productlist"."pidlist" IS 'Number automatically assigned to new product.';
COMMENT ON TABLE "productlist" IS 'Product names, suppliers, prices, and units in stock.';

-- CREATE INDEXES ...
CREATE UNIQUE INDEX "productlist_barcode_idx" ON "productlist" ("barcode");
CREATE INDEX "productlist_category_idx" ON "productlist" ("category");
ALTER TABLE "productlist" ADD CONSTRAINT "productlist_pkey" PRIMARY KEY ("pidlist");
CREATE UNIQUE INDEX "productlist_productname_idx" ON "productlist" ("productname");

CREATE TABLE IF NOT EXISTS "products"
 (
	"productid"			SERIAL, 
	"productname"			VARCHAR (250) NOT NULL, 
	"productnamear"			VARCHAR (250), 
	"producticonname"			VARCHAR (250), 
	"prodcodeno"			DOUBLE PRECISION, 
	"prodcodetxt"			VARCHAR (50), 
	"barcode"			VARCHAR (50), 
	"unit"			INTEGER, 
	"stockprod"			VARCHAR (50), 
	"color"			INTEGER, 
	"thickness"			INTEGER, 
	"desc"			VARCHAR (150), 
	"supplierid"			INTEGER, 
	"categoryid"			INTEGER, 
	"quantity"			REAL, 
	"lastinvprice"			REAL, 
	"lastinvdiscount"			REAL, 
	"price"			DOUBLE PRECISION, 
	"discount"			REAL, 
	"lostpercent"			REAL, 
	"transportin"			REAL, 
	"transporout"			REAL, 
	"preparing"			REAL, 
	"initialprice"			REAL, 
	"initialpricelbp"			REAL, 
	"unitprice"			REAL, 
	"unitpricec"			REAL, 
	"unitpricer"			REAL, 
	"unitpricelbp"			REAL, 
	"unitpriceclbp"			REAL, 
	"unitpricerlbp"			REAL, 
	"saledisc1"			REAL, 
	"saledisc2"			REAL, 
	"saledisc3"			REAL, 
	"stock"			REAL, 
	"unitsonorder"			REAL, 
	"reorderlevel"			INTEGER, 
	"discontinued"			BOOLEAN NOT NULL, 
	"note"			VARCHAR (250), 
	"stocklevel"			REAL, 
	"levelinitial"			REAL, 
	"bback"			REAL, 
	"vatrate"			REAL, 
	"dollarrate"			REAL, 
	"currency"			VARCHAR (50), 
	"expenpercent1"			REAL, 
	"expenfixed1"			REAL, 
	"expenpercent2"			REAL, 
	"expenfixed2"			REAL, 
	"stockb1"			REAL, 
	"stockb2"			REAL, 
	"stockb3"			REAL, 
	"stockb4"			REAL, 
	"stockbcheck"			VARCHAR (50), 
	"qtyperunit"			REAL, 
	"sourceprod"			INTEGER, 
	"addtransprate"			BOOLEAN NOT NULL, 
	"aaccount"			INTEGER, 
	"aaccid"			INTEGER, 
	"nopurchase"			BOOLEAN NOT NULL, 
	"nosale"			BOOLEAN NOT NULL, 
	"aaccountmainid"			INTEGER, 
	"vatprod"			BOOLEAN NOT NULL, 
	"totalqtyin"			REAL, 
	"totalqtyout"			REAL, 
	"befdate1stock"			REAL, 
	"btwdate1date2stock"			REAL, 
	"availableprod"			BOOLEAN NOT NULL, 
	"prodlocationn"			INTEGER
);
COMMENT ON COLUMN "products"."productid" IS 'Number automatically assigned to new product.';
COMMENT ON COLUMN "products"."supplierid" IS 'Same entry as in Suppliers table.';
COMMENT ON COLUMN "products"."categoryid" IS 'Same entry as in Categories table.';
COMMENT ON COLUMN "products"."transporout" IS ' ';
COMMENT ON COLUMN "products"."unitprice" IS 'Est Price';
COMMENT ON COLUMN "products"."unitpricec" IS 'Co Price';
COMMENT ON COLUMN "products"."unitpricer" IS 'Retail Price';
COMMENT ON COLUMN "products"."unitpricelbp" IS 'Est Price';
COMMENT ON COLUMN "products"."unitpriceclbp" IS 'Co Price';
COMMENT ON COLUMN "products"."unitpricerlbp" IS 'Retail Price';
COMMENT ON COLUMN "products"."reorderlevel" IS 'Minimum units to maintain in stock.';
COMMENT ON COLUMN "products"."discontinued" IS 'Yes means item is no longer available.';
COMMENT ON COLUMN "products"."stockb1" IS 'Bracnh 1';
COMMENT ON COLUMN "products"."stockb2" IS 'Bracnh 2';
COMMENT ON COLUMN "products"."stockb3" IS 'Bracnh 3';
COMMENT ON COLUMN "products"."stockb4" IS 'Bracnh 4';
COMMENT ON COLUMN "products"."availableprod" IS 'Using  Now for Water Galon year to Display at Daily Dist. Report';
COMMENT ON TABLE "products" IS 'Product names, suppliers, prices, and units in stock.';

-- CREATE INDEXES ...
CREATE INDEX "products_aaccid_idx" ON "products" ("aaccid");
CREATE INDEX "products_aaccountmainid_idx" ON "products" ("aaccountmainid");
CREATE INDEX "products_barcode_idx" ON "products" ("barcode");
CREATE INDEX "products_categoryid_idx" ON "products" ("categoryid");
ALTER TABLE "products" ADD CONSTRAINT "products_pkey" PRIMARY KEY ("productid");
CREATE UNIQUE INDEX "products_prodcodeno_idx" ON "products" ("prodcodeno");
CREATE INDEX "products_prodcodetxt_idx" ON "products" ("prodcodetxt");
CREATE UNIQUE INDEX "products_productname_idx" ON "products" ("productname");
CREATE INDEX "products_productnamear_idx" ON "products" ("productnamear");
CREATE INDEX "products_supplierid_idx" ON "products" ("supplierid");

CREATE TABLE IF NOT EXISTS "products 0"
 (
	"productid"			SERIAL, 
	"productname"			VARCHAR (250) NOT NULL, 
	"productnamear"			VARCHAR (250), 
	"producticonname"			VARCHAR (250), 
	"prodcodeno"			DOUBLE PRECISION, 
	"prodcodetxt"			VARCHAR (50), 
	"barcode"			VARCHAR (50), 
	"unit"			INTEGER, 
	"stockprod"			VARCHAR (50), 
	"color"			INTEGER, 
	"thickness"			INTEGER, 
	"desc"			VARCHAR (150), 
	"supplierid"			INTEGER, 
	"categoryid"			INTEGER, 
	"quantity"			REAL, 
	"lastinvprice"			REAL, 
	"lastinvdiscount"			REAL, 
	"price"			DOUBLE PRECISION, 
	"discount"			REAL, 
	"lostpercent"			REAL, 
	"transportin"			REAL, 
	"transporout"			REAL, 
	"preparing"			REAL, 
	"initialprice"			REAL, 
	"initialpricelbp"			REAL, 
	"unitprice"			REAL, 
	"unitpricec"			REAL, 
	"unitpricer"			REAL, 
	"unitpricelbp"			REAL, 
	"unitpriceclbp"			REAL, 
	"unitpricerlbp"			REAL, 
	"saledisc1"			REAL, 
	"saledisc2"			REAL, 
	"saledisc3"			REAL, 
	"stock"			REAL, 
	"unitsonorder"			REAL, 
	"reorderlevel"			INTEGER, 
	"discontinued"			BOOLEAN NOT NULL, 
	"note"			VARCHAR (250), 
	"stocklevel"			REAL, 
	"levelinitial"			REAL, 
	"bback"			REAL, 
	"vatrate"			REAL, 
	"dollarrate"			REAL, 
	"currency"			VARCHAR (50), 
	"expenpercent1"			REAL, 
	"expenfixed1"			REAL, 
	"expenpercent2"			REAL, 
	"expenfixed2"			REAL, 
	"stockb1"			REAL, 
	"stockb2"			REAL, 
	"stockb3"			REAL, 
	"stockb4"			REAL, 
	"stockbcheck"			VARCHAR (50), 
	"qtyperunit"			REAL, 
	"sourceprod"			INTEGER, 
	"addtransprate"			BOOLEAN NOT NULL, 
	"aaccount"			INTEGER, 
	"aaccid"			INTEGER, 
	"nopurchase"			BOOLEAN NOT NULL, 
	"nosale"			BOOLEAN NOT NULL, 
	"aaccountmainid"			INTEGER, 
	"vatprod"			BOOLEAN NOT NULL, 
	"totalqtyin"			REAL, 
	"totalqtyout"			REAL, 
	"befdate1stock"			REAL, 
	"btwdate1date2stock"			REAL, 
	"availableprod"			BOOLEAN NOT NULL, 
	"prodlocationn"			INTEGER
);
COMMENT ON COLUMN "products 0"."productid" IS 'Number automatically assigned to new product.';
COMMENT ON COLUMN "products 0"."supplierid" IS 'Same entry as in Suppliers table.';
COMMENT ON COLUMN "products 0"."categoryid" IS 'Same entry as in Categories table.';
COMMENT ON COLUMN "products 0"."transporout" IS ' ';
COMMENT ON COLUMN "products 0"."unitprice" IS 'Est Price';
COMMENT ON COLUMN "products 0"."unitpricec" IS 'Co Price';
COMMENT ON COLUMN "products 0"."unitpricer" IS 'Retail Price';
COMMENT ON COLUMN "products 0"."unitpricelbp" IS 'Est Price';
COMMENT ON COLUMN "products 0"."unitpriceclbp" IS 'Co Price';
COMMENT ON COLUMN "products 0"."unitpricerlbp" IS 'Retail Price';
COMMENT ON COLUMN "products 0"."reorderlevel" IS 'Minimum units to maintain in stock.';
COMMENT ON COLUMN "products 0"."discontinued" IS 'Yes means item is no longer available.';
COMMENT ON COLUMN "products 0"."stockb1" IS 'Bracnh 1';
COMMENT ON COLUMN "products 0"."stockb2" IS 'Bracnh 2';
COMMENT ON COLUMN "products 0"."stockb3" IS 'Bracnh 3';
COMMENT ON COLUMN "products 0"."stockb4" IS 'Bracnh 4';
COMMENT ON COLUMN "products 0"."availableprod" IS 'Using  Now for Water Galon year to Display at Daily Dist. Report';
COMMENT ON TABLE "products 0" IS 'Product names, suppliers, prices, and units in stock.';

-- CREATE INDEXES ...
CREATE INDEX "products 0_aaccid_idx" ON "products 0" ("aaccid");
CREATE INDEX "products 0_aaccountmainid_idx" ON "products 0" ("aaccountmainid");
CREATE INDEX "products 0_barcode_idx" ON "products 0" ("barcode");
CREATE INDEX "products 0_categoryid_idx" ON "products 0" ("categoryid");
ALTER TABLE "products 0" ADD CONSTRAINT "products 0_pkey" PRIMARY KEY ("productid");
CREATE UNIQUE INDEX "products 0_prodcodeno_idx" ON "products 0" ("prodcodeno");
CREATE INDEX "products 0_prodcodetxt_idx" ON "products 0" ("prodcodetxt");
CREATE UNIQUE INDEX "products 0_productname_idx" ON "products 0" ("productname");
CREATE INDEX "products 0_productnamear_idx" ON "products 0" ("productnamear");
CREATE INDEX "products 0_supplierid_idx" ON "products 0" ("supplierid");

CREATE TABLE IF NOT EXISTS "projects"
 (
	"projectid"			SERIAL, 
	"timecreate"			TIMESTAMP WITHOUT TIME ZONE, 
	"projectname"			VARCHAR (50), 
	"projectdescription"			VARCHAR (250), 
	"customerid"			INTEGER, 
	"projecttotalbillingestimate"			DOUBLE PRECISION, 
	"unitprice"			REAL, 
	"projectbegindate"			DATE, 
	"projectenddate"			DATE, 
	"fax number"			VARCHAR (255), 
	"email address"			VARCHAR (255), 
	"notes"			TEXT, 
	"active"			BOOLEAN NOT NULL
);

-- CREATE INDEXES ...
CREATE INDEX "projects_customerid_idx" ON "projects" ("customerid");
ALTER TABLE "projects" ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("projectid");
CREATE UNIQUE INDEX "projects_projectname_idx" ON "projects" ("projectname");

CREATE TABLE IF NOT EXISTS "projstatement"
 (
	"id"			SERIAL, 
	"projectname"			VARCHAR (50), 
	"date"			TIMESTAMP WITHOUT TIME ZONE, 
	"statetime"			TIMESTAMP WITHOUT TIME ZONE, 
	"invdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"invid"			INTEGER, 
	"invamount"			DOUBLE PRECISION, 
	"discount"			DOUBLE PRECISION, 
	"paydate"			TIMESTAMP WITHOUT TIME ZONE, 
	"payid"			INTEGER, 
	"payamount"			DOUBLE PRECISION, 
	"paymethod"			VARCHAR (50), 
	"balance"			REAL, 
	"note"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "projstatement_id_idx" ON "projstatement" ("id");
CREATE INDEX "projstatement_invid_idx" ON "projstatement" ("invid");
CREATE INDEX "projstatement_payid_idx" ON "projstatement" ("payid");
ALTER TABLE "projstatement" ADD CONSTRAINT "projstatement_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "purchasevoucher"
 (
	"id"			SERIAL, 
	"pvid"			INTEGER, 
	"pvdate"			DATE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"customer"			INTEGER, 
	"dollarrate"			DOUBLE PRECISION, 
	"perpose"			VARCHAR (100), 
	"invno"			VARCHAR (50), 
	"amt"			REAL, 
	"amtusd"			REAL, 
	"amtusdvat"			REAL, 
	"amtusdprev"			REAL, 
	"amtlbp"			REAL, 
	"paymentmethod"			VARCHAR (50), 
	"checknumber"			VARCHAR (50), 
	"bank"			VARCHAR (50), 
	"checkdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"note"			VARCHAR (100), 
	"vatrate"			REAL, 
	"employeeid"			INTEGER, 
	"currency"			VARCHAR (50), 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"salesman"			INTEGER, 
	"status"			VARCHAR (50), 
	"tansref"			VARCHAR (50), 
	"custproj"			INTEGER
);
COMMENT ON COLUMN "purchasevoucher"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';
COMMENT ON COLUMN "purchasevoucher"."salesman" IS 'ExReceipt';

-- CREATE INDEXES ...
CREATE INDEX "purchasevoucher_bank_idx" ON "purchasevoucher" ("bank");
CREATE INDEX "purchasevoucher_checknumber_idx" ON "purchasevoucher" ("checknumber");
CREATE INDEX "purchasevoucher_cnid_idx" ON "purchasevoucher" ("pvid");
CREATE INDEX "purchasevoucher_codeid_idx" ON "purchasevoucher" ("codeid");
CREATE INDEX "purchasevoucher_employeeid_idx" ON "purchasevoucher" ("employeeid");
CREATE INDEX "purchasevoucher_id_idx" ON "purchasevoucher" ("id");
CREATE INDEX "purchasevoucher_jvid_idx" ON "purchasevoucher" ("jvid");
ALTER TABLE "purchasevoucher" ADD CONSTRAINT "purchasevoucher_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "receivername"
 (
	"rid"			SERIAL, 
	"receivername"			VARCHAR (50), 
	"customer"			INTEGER, 
	"note"			VARCHAR (50)
);

-- CREATE INDEXES ...
ALTER TABLE "receivername" ADD CONSTRAINT "receivername_pkey" PRIMARY KEY ("rid");
CREATE INDEX "receivername_rid_idx" ON "receivername" ("rid");

CREATE TABLE IF NOT EXISTS "regiondata"
 (
	"rid"			SERIAL, 
	"region"			VARCHAR (50), 
	"addrate1"			REAL, 
	"addrate2"			REAL, 
	"addrate3"			REAL, 
	"description"			VARCHAR (100)
);
COMMENT ON COLUMN "regiondata"."addrate1" IS 'Transport Rate';

-- CREATE INDEXES ...
ALTER TABLE "regiondata" ADD CONSTRAINT "regiondata_pkey" PRIMARY KEY ("rid");
CREATE INDEX "regiondata_rid_idx" ON "regiondata" ("rid");

CREATE TABLE IF NOT EXISTS "reminderdateprod"
 (
	"idd"			SERIAL, 
	"customer"			INTEGER NOT NULL, 
	"productid"			INTEGER, 
	"namesub"			VARCHAR (70), 
	"moderator"			VARCHAR (70), 
	"remindertype"			INTEGER, 
	"duedate"			DATE NOT NULL, 
	"noote"			VARCHAR (10), 
	"nnoww"			TIMESTAMP WITHOUT TIME ZONE, 
	"remindersatus"			VARCHAR (50) NOT NULL
);

-- CREATE INDEXES ...
CREATE INDEX "reminderdateprod_customerwsid_idx" ON "reminderdateprod" ("customer");
CREATE INDEX "reminderdateprod_idd_idx" ON "reminderdateprod" ("idd");
ALTER TABLE "reminderdateprod" ADD CONSTRAINT "reminderdateprod_pkey" PRIMARY KEY ("idd");
CREATE INDEX "reminderdateprod_productid_idx" ON "reminderdateprod" ("productid");

CREATE TABLE IF NOT EXISTS "remindertype"
 (
	"idd"			SERIAL, 
	"remindertypename"			VARCHAR (100), 
	"noote"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "remindertype_idd_idx" ON "remindertype" ("idd");
ALTER TABLE "remindertype" ADD CONSTRAINT "remindertype_pkey" PRIMARY KEY ("idd");

CREATE TABLE IF NOT EXISTS "retcustinv"
 (
	"custinvretid"			SERIAL, 
	"invnoret"			INTEGER NOT NULL, 
	"customerwsid"			INTEGER, 
	"custtype"			INTEGER, 
	"projectnameinv"			VARCHAR (50), 
	"account"			DOUBLE PRECISION, 
	"status"			VARCHAR (20), 
	"custinvretdate"			DATE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"discinvret"			DOUBLE PRECISION, 
	"discinveurret"			DOUBLE PRECISION, 
	"vatinv"			REAL, 
	"vateur"			REAL, 
	"amountretinv"			REAL, 
	"notes"			TEXT, 
	"dollarprice"			REAL, 
	"eurodollar"			REAL, 
	"currency"			VARCHAR (50), 
	"paymentterms"			VARCHAR (100), 
	"supref"			VARCHAR (50), 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"salesman"			INTEGER, 
	"prevcustinvretid"			INTEGER, 
	"stockref"			INTEGER, 
	"vatrate"			REAL, 
	"vatrateinc"			REAL, 
	"tansref"			VARCHAR (50), 
	"custproj"			INTEGER
);
COMMENT ON COLUMN "retcustinv"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';
COMMENT ON COLUMN "retcustinv"."salesman" IS 'ExReceipt';

-- CREATE INDEXES ...
CREATE INDEX "retcustinv_codeid_idx" ON "retcustinv" ("codeid");
CREATE INDEX "retcustinv_customerid_idx" ON "retcustinv" ("customerwsid");
CREATE INDEX "retcustinv_employeeid_idx" ON "retcustinv" ("employeeid");
CREATE INDEX "retcustinv_invno_idx" ON "retcustinv" ("invnoret");
CREATE INDEX "retcustinv_jvid_idx" ON "retcustinv" ("jvid");
CREATE INDEX "retcustinv_prevcustinvretid_idx" ON "retcustinv" ("prevcustinvretid");
ALTER TABLE "retcustinv" ADD CONSTRAINT "retcustinv_pkey" PRIMARY KEY ("custinvretid");

CREATE TABLE IF NOT EXISTS "retcustinvdet"
 (
	"custinvretdetailid"			SERIAL, 
	"custinvretid"			INTEGER, 
	"productid"			INTEGER, 
	"prodcodeno"			INTEGER, 
	"prodcodetxt"			INTEGER, 
	"barcode"			INTEGER, 
	"unit"			INTEGER, 
	"box"			REAL, 
	"quantity"			REAL, 
	"meas"			REAL, 
	"unitprice"			REAL, 
	"initialprice"			REAL, 
	"unitpriceeur"			DOUBLE PRECISION, 
	"discount"			REAL, 
	"paymentterms"			VARCHAR (255), 
	"sn1"			VARCHAR (50), 
	"sn2"			VARCHAR (50), 
	"note"			VARCHAR (150), 
	"orderid"			INTEGER, 
	"projectnamedet"			VARCHAR (50), 
	"check"			BOOLEAN NOT NULL, 
	"lenght11"			REAL, 
	"width11"			REAL, 
	"quantity1"			REAL, 
	"prevcustinvretiddet"			INTEGER, 
	"stockref"			INTEGER, 
	"vatrate"			REAL, 
	"vatrateinc"			REAL, 
	"proddate"			DATE
);

-- CREATE INDEXES ...
CREATE INDEX "retcustinvdet_barcode_idx" ON "retcustinvdet" ("barcode");
CREATE INDEX "retcustinvdet_custinvoicedetailid_idx" ON "retcustinvdet" ("custinvretdetailid");
CREATE INDEX "retcustinvdet_custinvoiceid_idx" ON "retcustinvdet" ("custinvretid");
CREATE INDEX "retcustinvdet_orderid_idx" ON "retcustinvdet" ("orderid");
CREATE INDEX "retcustinvdet_prevcustinvretid_idx" ON "retcustinvdet" ("prevcustinvretiddet");
ALTER TABLE "retcustinvdet" ADD CONSTRAINT "retcustinvdet_pkey" PRIMARY KEY ("custinvretdetailid");
CREATE INDEX "retcustinvdet_prodcodeno_idx" ON "retcustinvdet" ("prodcodeno");
CREATE INDEX "retcustinvdet_prodcodetxt_idx" ON "retcustinvdet" ("prodcodetxt");
CREATE INDEX "retcustinvdet_productid_idx" ON "retcustinvdet" ("productid");

CREATE TABLE IF NOT EXISTS "sectionselection"
 (
	"idd"			SERIAL, 
	"sectionname"			VARCHAR (50), 
	"descrition"			VARCHAR (50), 
	"prodidpurincome"			INTEGER, 
	"prodcatpursale"			INTEGER, 
	"expetypecateg"			VARCHAR (50), 
	"catgincome"			INTEGER, 
	"catgoutcome"			INTEGER
);

-- CREATE INDEXES ...
CREATE INDEX "sectionselection_idd_idx" ON "sectionselection" ("idd");
ALTER TABLE "sectionselection" ADD CONSTRAINT "sectionselection_pkey" PRIMARY KEY ("idd");

CREATE TABLE IF NOT EXISTS "sectionstatement"
 (
	"id"			SERIAL, 
	"sectionname"			VARCHAR (50), 
	"sectiondate"			DATE, 
	"sectiontype"			VARCHAR (50), 
	"prodid"			INTEGER, 
	"prodname"			VARCHAR (50), 
	"expenesename"			VARCHAR (50), 
	"qty"			REAL, 
	"price"			REAL, 
	"amtin"			REAL, 
	"amtout"			REAL, 
	"refid"			INTEGER, 
	"reftext"			VARCHAR (50), 
	"custid"			INTEGER, 
	"supid"			INTEGER, 
	"expenclientid"			INTEGER, 
	"expenclienttxt"			VARCHAR (50)
);
COMMENT ON COLUMN "sectionstatement"."sectiontype" IS 'Pirchase + , Purchase- , Sale+ , Expeneses-';

-- CREATE INDEXES ...
CREATE INDEX "sectionstatement_custid_idx" ON "sectionstatement" ("custid");
CREATE INDEX "sectionstatement_expenclientid_idx" ON "sectionstatement" ("expenclientid");
CREATE INDEX "sectionstatement_id_idx" ON "sectionstatement" ("id");
ALTER TABLE "sectionstatement" ADD CONSTRAINT "sectionstatement_pkey" PRIMARY KEY ("id");
CREATE INDEX "sectionstatement_prodid_idx" ON "sectionstatement" ("prodid");
CREATE INDEX "sectionstatement_refid_idx" ON "sectionstatement" ("refid");
CREATE INDEX "sectionstatement_supid_idx" ON "sectionstatement" ("supid");

CREATE TABLE IF NOT EXISTS "secu"
 (
	"text"			INTEGER
);

-- CREATE INDEXES ...

CREATE TABLE IF NOT EXISTS "smswebdata"
 (
	"autoid"			SERIAL, 
	"smsid"			VARCHAR (50), 
	"smsuser"			VARCHAR (50), 
	"smspass"			VARCHAR (50), 
	"smsdata"			VARCHAR (255)
);

-- CREATE INDEXES ...
CREATE INDEX "smswebdata_autoid_idx" ON "smswebdata" ("autoid");
ALTER TABLE "smswebdata" ADD CONSTRAINT "smswebdata_pkey" PRIMARY KEY ("autoid");
CREATE INDEX "smswebdata_smsid_idx" ON "smswebdata" ("smsid");

CREATE TABLE IF NOT EXISTS "sourcecashinout"
 (
	"id"			SERIAL, 
	"sname"			VARCHAR (50), 
	"snote"			VARCHAR (50), 
	"aaccount"			INTEGER, 
	"aaccid"			INTEGER, 
	"aaccountmainid"			INTEGER
);

-- CREATE INDEXES ...
CREATE INDEX "sourcecashinout_aaccid_idx" ON "sourcecashinout" ("aaccid");
CREATE INDEX "sourcecashinout_aaccountmainid_idx" ON "sourcecashinout" ("aaccountmainid");
CREATE INDEX "sourcecashinout_id_idx" ON "sourcecashinout" ("id");
ALTER TABLE "sourcecashinout" ADD CONSTRAINT "sourcecashinout_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "statement"
 (
	"stid"			SERIAL, 
	"stdate"			DATE, 
	"productid"			INTEGER, 
	"unitprice"			DOUBLE PRECISION, 
	"quantity"			DOUBLE PRECISION, 
	"customerid"			INTEGER NOT NULL, 
	"discount"			DOUBLE PRECISION, 
	"paymentmethod"			VARCHAR (50), 
	"paid"			DOUBLE PRECISION, 
	"amountrest"			DOUBLE PRECISION, 
	"paymentamount"			DOUBLE PRECISION
);
COMMENT ON COLUMN "statement"."productid" IS 'Same as Product ID in Products table.';
COMMENT ON TABLE "statement" IS 'Details on products, quantities, and prices for each order in the Orders table.';

-- CREATE INDEXES ...
CREATE INDEX "statement_customerid_idx" ON "statement" ("customerid");
CREATE INDEX "statement_ooid_idx" ON "statement" ("stid");
CREATE INDEX "statement_paid_idx" ON "statement" ("paid");
ALTER TABLE "statement" ADD CONSTRAINT "statement_pkey" PRIMARY KEY ("stid");
CREATE INDEX "statement_productid_idx" ON "statement" ("productid");

CREATE TABLE IF NOT EXISTS "stockinfo"
 (
	"stockid"			SERIAL, 
	"stockname"			VARCHAR (50), 
	"num1"			REAL, 
	"num2"			REAL, 
	"date1"			TIMESTAMP WITHOUT TIME ZONE, 
	"date2"			TIMESTAMP WITHOUT TIME ZONE, 
	"note1"			VARCHAR (50), 
	"note2"			VARCHAR (50), 
	"check1"			BOOLEAN NOT NULL, 
	"check2"			BOOLEAN NOT NULL
);

-- CREATE INDEXES ...
CREATE INDEX "stockinfo_num1_idx" ON "stockinfo" ("num1");
CREATE INDEX "stockinfo_num11_idx" ON "stockinfo" ("num2");
ALTER TABLE "stockinfo" ADD CONSTRAINT "stockinfo_pkey" PRIMARY KEY ("stockid");
CREATE INDEX "stockinfo_stockid_idx" ON "stockinfo" ("stockid");

CREATE TABLE IF NOT EXISTS "supcreditnote"
 (
	"id"			SERIAL, 
	"cnid"			INTEGER, 
	"cndate"			DATE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"supplier"			INTEGER, 
	"usdlbp"			REAL, 
	"eurousd"			REAL, 
	"perpose"			VARCHAR (100), 
	"invno"			VARCHAR (50), 
	"currency"			VARCHAR (50), 
	"amt"			REAL, 
	"amtusd"			REAL, 
	"amteur"			REAL, 
	"amtlbp"			REAL, 
	"paymentmethod"			INTEGER NOT NULL, 
	"checknumber"			VARCHAR (50), 
	"bank"			VARCHAR (50), 
	"checkdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"note"			VARCHAR (100), 
	"vatrate"			REAL, 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"status"			VARCHAR (50)
);
COMMENT ON COLUMN "supcreditnote"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "supcreditnote_bank_idx" ON "supcreditnote" ("bank");
CREATE INDEX "supcreditnote_checknumber_idx" ON "supcreditnote" ("checknumber");
CREATE INDEX "supcreditnote_cnid_idx" ON "supcreditnote" ("cnid");
CREATE INDEX "supcreditnote_codeid_idx" ON "supcreditnote" ("codeid");
CREATE INDEX "supcreditnote_employeeid_idx" ON "supcreditnote" ("employeeid");
CREATE INDEX "supcreditnote_id_idx" ON "supcreditnote" ("id");
CREATE INDEX "supcreditnote_jvid_idx" ON "supcreditnote" ("jvid");
ALTER TABLE "supcreditnote" ADD CONSTRAINT "supcreditnote_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "suporder"
 (
	"suporderid"			SERIAL, 
	"suporderno"			VARCHAR (50), 
	"supplierid"			INTEGER, 
	"orderdate"			DATE, 
	"ordertime"			TIMESTAMP WITHOUT TIME ZONE, 
	"notes"			VARCHAR (50), 
	"orderdiscount"			DOUBLE PRECISION, 
	"dollarrate"			REAL, 
	"amountinv"			REAL, 
	"invvat"			REAL, 
	"insideinote"			VARCHAR (50), 
	"currency"			VARCHAR (50), 
	"purcurrency"			VARCHAR (50), 
	"purcurrrate"			DOUBLE PRECISION, 
	"employeeid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"previnvoiceid"			INTEGER, 
	"status"			VARCHAR (20), 
	"stockref"			INTEGER
);
COMMENT ON COLUMN "suporder"."invvat" IS 'VAT %';
COMMENT ON COLUMN "suporder"."insideinote" IS 'Inside Inv Note';
COMMENT ON COLUMN "suporder"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "suporder_codeid_idx" ON "suporder" ("codeid");
CREATE INDEX "suporder_employeeid_idx" ON "suporder" ("employeeid");
CREATE INDEX "suporder_previnvoiceid_idx" ON "suporder" ("previnvoiceid");
ALTER TABLE "suporder" ADD CONSTRAINT "suporder_pkey" PRIMARY KEY ("suporderid");
CREATE INDEX "suporder_supplierid_idx" ON "suporder" ("supplierid");

CREATE TABLE IF NOT EXISTS "suppayments"
 (
	"paymentid"			SERIAL, 
	"suppayref"			VARCHAR (50), 
	"paymentdate"			DATE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"supplierid"			INTEGER, 
	"paymentamount"			DOUBLE PRECISION, 
	"paymentmethod"			INTEGER NOT NULL, 
	"checknumber"			DOUBLE PRECISION, 
	"bank"			VARCHAR (50), 
	"checkdate"			DATE, 
	"checkpass"			VARCHAR (50), 
	"notes"			TEXT, 
	"dollaramt"			DOUBLE PRECISION, 
	"llamt"			DOUBLE PRECISION, 
	"dollarrate"			DOUBLE PRECISION, 
	"fromaccount"			INTEGER NOT NULL, 
	"currency"			VARCHAR (50), 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"status"			VARCHAR (50), 
	"fromaaccount"			INTEGER NOT NULL
);
COMMENT ON COLUMN "suppayments"."fromaccount" IS 'To Supplier Payment';
COMMENT ON COLUMN "suppayments"."employeeid" IS 'it wasnt add unless it mentioned at Note Word file';
COMMENT ON COLUMN "suppayments"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';
COMMENT ON COLUMN "suppayments"."fromaaccount" IS 'From Acc Paid to Sup  (Cash , Bank ,... )  not Personal acc';

-- CREATE INDEXES ...
CREATE INDEX "suppayments_checknumber_idx" ON "suppayments" ("checknumber");
CREATE INDEX "suppayments_codeid_idx" ON "suppayments" ("codeid");
CREATE INDEX "suppayments_employeeid_idx" ON "suppayments" ("employeeid");
CREATE INDEX "suppayments_jvid_idx" ON "suppayments" ("jvid");
ALTER TABLE "suppayments" ADD CONSTRAINT "suppayments_pkey" PRIMARY KEY ("paymentid");
CREATE INDEX "suppayments_supplierid_idx" ON "suppayments" ("supplierid");

CREATE TABLE IF NOT EXISTS "suppaymentsdetails"
 (
	"suppaydetid"			SERIAL, 
	"suppaymentid"			INTEGER, 
	"paymentamount"			DOUBLE PRECISION, 
	"currency"			VARCHAR (50), 
	"usd"			DOUBLE PRECISION, 
	"lbp"			REAL, 
	"eur"			DOUBLE PRECISION, 
	"toaccount"			INTEGER, 
	"dollarrate"			DOUBLE PRECISION, 
	"paydettime"			TIMESTAMP WITHOUT TIME ZONE, 
	"paymentmethod"			VARCHAR (50), 
	"checknumber"			VARCHAR (50), 
	"bank"			VARCHAR (50), 
	"checkdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"checkpass"			VARCHAR (50), 
	"notes"			VARCHAR (150), 
	"checkstransref"			INTEGER
);
COMMENT ON COLUMN "suppaymentsdetails"."toaccount" IS 'From Customer Payment';

-- CREATE INDEXES ...
CREATE INDEX "suppaymentsdetails_bank_idx" ON "suppaymentsdetails" ("bank");
CREATE INDEX "suppaymentsdetails_checknumber_idx" ON "suppaymentsdetails" ("checknumber");
CREATE INDEX "suppaymentsdetails_paydetid_idx" ON "suppaymentsdetails" ("suppaydetid");
CREATE INDEX "suppaymentsdetails_paymentid_idx" ON "suppaymentsdetails" ("suppaymentid");
ALTER TABLE "suppaymentsdetails" ADD CONSTRAINT "suppaymentsdetails_pkey" PRIMARY KEY ("suppaydetid");

CREATE TABLE IF NOT EXISTS "suppliers"
 (
	"supplierid"			SERIAL, 
	"bname"			VARCHAR (50), 
	"suppliername"			VARCHAR (50), 
	"phonenumber"			VARCHAR (30), 
	"faxnumber"			VARCHAR (30), 
	"address"			VARCHAR (70), 
	"acc"			DOUBLE PRECISION, 
	"account"			DOUBLE PRECISION, 
	"bback"			REAL, 
	"aaccount"			INTEGER, 
	"aaccid"			INTEGER, 
	"aaccountmainid"			INTEGER
);
COMMENT ON COLUMN "suppliers"."bname" IS 'Before Name : Mr.;Eng.;Mrs.;Dr.;Miss;Sheikh;Messrs.السيد;السادة;المهندس;الشيخ;الدكتور;الشيخ;السيدة';

-- CREATE INDEXES ...
CREATE INDEX "suppliers_aaccid_idx" ON "suppliers" ("aaccid");
CREATE INDEX "suppliers_aaccountmainid_idx" ON "suppliers" ("aaccountmainid");
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("supplierid");
CREATE INDEX "suppliers_suppliername_idx" ON "suppliers" ("suppliername");

CREATE TABLE IF NOT EXISTS "suppurchasevoucher"
 (
	"id"			SERIAL, 
	"spvid"			INTEGER, 
	"spvdate"			DATE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"supplier"			INTEGER, 
	"usdlbp"			REAL, 
	"eurousd"			REAL, 
	"perpose"			VARCHAR (100), 
	"invno"			INTEGER, 
	"invnoref"			VARCHAR (50), 
	"spvtype"			INTEGER, 
	"currency"			VARCHAR (50), 
	"amt"			REAL, 
	"amtusd"			REAL, 
	"amtlbp"			REAL, 
	"paymentmethod"			INTEGER NOT NULL, 
	"checknumber"			VARCHAR (50), 
	"bank"			VARCHAR (50), 
	"checkdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"note"			VARCHAR (100), 
	"vatrate"			REAL, 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"status"			VARCHAR (50)
);
COMMENT ON COLUMN "suppurchasevoucher"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "suppurchasevoucher_bank_idx" ON "suppurchasevoucher" ("bank");
CREATE INDEX "suppurchasevoucher_checknumber_idx" ON "suppurchasevoucher" ("checknumber");
CREATE INDEX "suppurchasevoucher_cnid_idx" ON "suppurchasevoucher" ("spvid");
CREATE INDEX "suppurchasevoucher_codeid_idx" ON "suppurchasevoucher" ("codeid");
CREATE INDEX "suppurchasevoucher_employeeid_idx" ON "suppurchasevoucher" ("employeeid");
CREATE INDEX "suppurchasevoucher_id_idx" ON "suppurchasevoucher" ("id");
CREATE INDEX "suppurchasevoucher_jvid_idx" ON "suppurchasevoucher" ("jvid");
ALTER TABLE "suppurchasevoucher" ADD CONSTRAINT "suppurchasevoucher_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "suppurvtype"
 (
	"idd"			SERIAL, 
	"suppurvt"			VARCHAR (50), 
	"nnote"			VARCHAR (150)
);

-- CREATE INDEXES ...
CREATE INDEX "suppurvtype_idd_idx" ON "suppurvtype" ("idd");
ALTER TABLE "suppurvtype" ADD CONSTRAINT "suppurvtype_pkey" PRIMARY KEY ("idd");

CREATE TABLE IF NOT EXISTS "supstatement1st"
 (
	"id"			SERIAL, 
	"supplierid"			INTEGER, 
	"date"			TIMESTAMP WITHOUT TIME ZONE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"invoiceid"			INTEGER, 
	"supinvoiceno"			VARCHAR (50), 
	"invtotal"			DOUBLE PRECISION, 
	"paymentid"			INTEGER, 
	"paymentamount"			DOUBLE PRECISION, 
	"paymentmethod"			INTEGER, 
	"accnow"			REAL, 
	"currency"			VARCHAR (50), 
	"codeid"			VARCHAR (50), 
	"stype"			VARCHAR (50), 
	"note"			VARCHAR (70), 
	"checkno"			VARCHAR (50), 
	"checkdate"			DATE, 
	"checkbankname"			VARCHAR (50), 
	"vdate"			DATE, 
	"dollarratev"			REAL, 
	"payamtusd"			DOUBLE PRECISION, 
	"payamtlbp"			DOUBLE PRECISION
);
COMMENT ON COLUMN "supstatement1st"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';
COMMENT ON COLUMN "supstatement1st"."stype" IS 'Inv, Pay , CN , ..';
COMMENT ON COLUMN "supstatement1st"."vdate" IS 'Value Date';

-- CREATE INDEXES ...
CREATE INDEX "supstatement1st_codeid_idx" ON "supstatement1st" ("codeid");
CREATE INDEX "supstatement1st_id_idx" ON "supstatement1st" ("id");
CREATE INDEX "supstatement1st_invoiceid_idx" ON "supstatement1st" ("invoiceid");
CREATE INDEX "supstatement1st_paymentid_idx" ON "supstatement1st" ("paymentid");
ALTER TABLE "supstatement1st" ADD CONSTRAINT "supstatement1st_pkey" PRIMARY KEY ("id");
CREATE INDEX "supstatement1st_supplierid_idx" ON "supstatement1st" ("supplierid");

CREATE TABLE IF NOT EXISTS "table1"
 (
	"id"			SERIAL, 
	"count"			INTEGER
);

-- CREATE INDEXES ...
CREATE INDEX "table1_id_idx" ON "table1" ("id");
ALTER TABLE "table1" ADD CONSTRAINT "table1_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "table2"
 (
	"id"			SERIAL, 
	"tee"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "table2_id_idx" ON "table2" ("id");
ALTER TABLE "table2" ADD CONSTRAINT "table2_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "tablesinfo"
 (
	"idd"			SERIAL, 
	"tableno"			INTEGER, 
	"tablesname"			VARCHAR (50), 
	"num1"			INTEGER, 
	"available"			BOOLEAN NOT NULL, 
	"note1"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "tablesinfo_idd_idx" ON "tablesinfo" ("idd");
CREATE INDEX "tablesinfo_num1_idx" ON "tablesinfo" ("num1");
ALTER TABLE "tablesinfo" ADD CONSTRAINT "tablesinfo_pkey" PRIMARY KEY ("idd");

CREATE TABLE IF NOT EXISTS "tblautonumbersummary"
 (
	"tablename"			VARCHAR (64), 
	"fieldname"			VARCHAR (64), 
	"maxvalue"			INTEGER
);

-- CREATE INDEXES ...

CREATE TABLE IF NOT EXISTS "tblreports"
 (
	"id"			SERIAL, 
	"reportname"			VARCHAR (70)
);

-- CREATE INDEXES ...
ALTER TABLE "tblreports" ADD CONSTRAINT "tblreports_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "thickness"
 (
	"thicknessid"			SERIAL, 
	"thickness"			REAL
);

-- CREATE INDEXES ...
ALTER TABLE "thickness" ADD CONSTRAINT "thickness_pkey" PRIMARY KEY ("thicknessid");
CREATE INDEX "thickness_thicknessid_idx" ON "thickness" ("thicknessid");
CREATE INDEX "thickness_thicknessid1_idx" ON "thickness" ("thickness");

CREATE TABLE IF NOT EXISTS "timesheeet"
 (
	"iddd"			SERIAL, 
	"maincutdateid"			INTEGER, 
	"idddd"			INTEGER, 
	"aid"			INTEGER, 
	"ddate"			TIMESTAMP WITHOUT TIME ZONE, 
	"dtime"			TIMESTAMP WITHOUT TIME ZONE, 
	"worker"			INTEGER, 
	"cust"			INTEGER, 
	"timein"			TIMESTAMP WITHOUT TIME ZONE, 
	"timeout"			TIMESTAMP WITHOUT TIME ZONE, 
	"timespendmin"			REAL, 
	"timespendtime"			TIMESTAMP WITHOUT TIME ZONE, 
	"calctype"			VARCHAR (50), 
	"timespendround"			INTEGER, 
	"timeround"			TIMESTAMP WITHOUT TIME ZONE, 
	"rrate"			REAL, 
	"timetype"			VARCHAR (50), 
	"note1"			VARCHAR (200), 
	"note2"			VARCHAR (200), 
	"status"			VARCHAR (50), 
	"refinv"			INTEGER, 
	"reftxt"			VARCHAR (50), 
	"check1"			BOOLEAN NOT NULL, 
	"check2"			BOOLEAN NOT NULL, 
	"overtime"			DATE
);
COMMENT ON COLUMN "timesheeet"."maincutdateid" IS 'CustPlanID Main';
COMMENT ON COLUMN "timesheeet"."idddd" IS 'CustPlanID Date Time';
COMMENT ON COLUMN "timesheeet"."aid" IS 'CustPlanID Employe';

-- CREATE INDEXES ...
CREATE INDEX "timesheeet_aid_idx" ON "timesheeet" ("aid");
CREATE UNIQUE INDEX "timesheeet_iddd_idx" ON "timesheeet" ("iddd");
CREATE INDEX "timesheeet_idddd_idx" ON "timesheeet" ("idddd");
CREATE INDEX "timesheeet_maincutdateid_idx" ON "timesheeet" ("maincutdateid");
ALTER TABLE "timesheeet" ADD CONSTRAINT "timesheeet_pkey" PRIMARY KEY ("maincutdateid", "idddd", "aid", "ddate");

CREATE TABLE IF NOT EXISTS "timessss"
 (
	"iddasda"			SERIAL, 
	"cust"			VARCHAR (50), 
	"time11"			TIMESTAMP WITHOUT TIME ZONE
);

-- CREATE INDEXES ...
CREATE INDEX "timessss_iddasda_idx" ON "timessss" ("iddasda");
ALTER TABLE "timessss" ADD CONSTRAINT "timessss_pkey" PRIMARY KEY ("iddasda");

CREATE TABLE IF NOT EXISTS "transdollar"
 (
	"id"			SERIAL, 
	"type"			INTEGER, 
	"name"			VARCHAR (50), 
	"qty"			INTEGER, 
	"rate"			REAL, 
	"transrate"			REAL, 
	"pricedollar"			REAL, 
	"pricell"			REAL
);

-- CREATE INDEXES ...
CREATE INDEX "transdollar_id_idx" ON "transdollar" ("id");
ALTER TABLE "transdollar" ADD CONSTRAINT "transdollar_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "transferbtstocks"
 (
	"transferid"			SERIAL, 
	"transferref"			VARCHAR (50), 
	"enteringdatetime"			TIMESTAMP WITHOUT TIME ZONE, 
	"transferdate"			DATE, 
	"transfertime"			TIMESTAMP WITHOUT TIME ZONE, 
	"transferfromstock"			INTEGER, 
	"transfertostock"			INTEGER, 
	"notes"			VARCHAR (150), 
	"dollarrate"			REAL, 
	"transferamount"			REAL, 
	"transfervat"			REAL, 
	"insideinote"			VARCHAR (150), 
	"currency"			VARCHAR (50), 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"status"			VARCHAR (20), 
	"stockref"			INTEGER, 
	"custid"			INTEGER, 
	"custid2"			INTEGER
);
COMMENT ON COLUMN "transferbtstocks"."transfervat" IS 'VAT %';
COMMENT ON COLUMN "transferbtstocks"."insideinote" IS 'Inside Inv Note';
COMMENT ON COLUMN "transferbtstocks"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "transferbtstocks_codeid_idx" ON "transferbtstocks" ("codeid");
CREATE INDEX "transferbtstocks_custid_idx" ON "transferbtstocks" ("custid");
CREATE INDEX "transferbtstocks_custid2_idx" ON "transferbtstocks" ("custid2");
CREATE INDEX "transferbtstocks_employeeid_idx" ON "transferbtstocks" ("employeeid");
CREATE INDEX "transferbtstocks_jvid_idx" ON "transferbtstocks" ("jvid");
ALTER TABLE "transferbtstocks" ADD CONSTRAINT "transferbtstocks_pkey" PRIMARY KEY ("transferid");

CREATE TABLE IF NOT EXISTS "transferbtstocksdet"
 (
	"transferdetid"			SERIAL, 
	"transferid"			INTEGER, 
	"enteringdatetime"			TIMESTAMP WITHOUT TIME ZONE, 
	"productid"			INTEGER, 
	"barcode"			INTEGER, 
	"prodcodeno"			INTEGER, 
	"prodcodetxt"			INTEGER, 
	"transferqty"			DOUBLE PRECISION, 
	"unit"			INTEGER, 
	"iniprice"			DOUBLE PRECISION, 
	"inicurrency"			VARCHAR (50), 
	"saleprice"			DOUBLE PRECISION, 
	"salecurrency"			VARCHAR (50), 
	"insideidnote"			VARCHAR (50), 
	"proddate"			DATE
);
COMMENT ON COLUMN "transferbtstocksdet"."insideidnote" IS 'Inside  Note';

-- CREATE INDEXES ...
CREATE INDEX "transferbtstocksdet_invoiceid_idx" ON "transferbtstocksdet" ("transferid");
ALTER TABLE "transferbtstocksdet" ADD CONSTRAINT "transferbtstocksdet_pkey" PRIMARY KEY ("transferdetid");
CREATE INDEX "transferbtstocksdet_prodcode_idx" ON "transferbtstocksdet" ("barcode");
CREATE INDEX "transferbtstocksdet_prodcodeno_idx" ON "transferbtstocksdet" ("prodcodeno");
CREATE INDEX "transferbtstocksdet_prodcodetxt_idx" ON "transferbtstocksdet" ("prodcodetxt");
CREATE INDEX "transferbtstocksdet_productid_idx" ON "transferbtstocksdet" ("productid");

CREATE TABLE IF NOT EXISTS "transferstocksinoutdet"
 (
	"transferinoutdetid"			SERIAL, 
	"transferinoutid"			INTEGER, 
	"entertraninoutiddatetime"			TIMESTAMP WITHOUT TIME ZONE, 
	"productid"			INTEGER, 
	"barcode"			INTEGER, 
	"prodcodeno"			INTEGER, 
	"prodcodetxt"			INTEGER, 
	"transferqty"			DOUBLE PRECISION, 
	"unit"			INTEGER, 
	"iniprice"			DOUBLE PRECISION, 
	"inicurrency"			VARCHAR (50), 
	"saleprice"			DOUBLE PRECISION, 
	"salecurrency"			VARCHAR (50), 
	"insideidnote"			VARCHAR (50), 
	"proddate"			DATE
);
COMMENT ON COLUMN "transferstocksinoutdet"."insideidnote" IS 'Inside  Note';

-- CREATE INDEXES ...
CREATE INDEX "transferstocksinoutdet_invoiceid_idx" ON "transferstocksinoutdet" ("transferinoutid");
ALTER TABLE "transferstocksinoutdet" ADD CONSTRAINT "transferstocksinoutdet_pkey" PRIMARY KEY ("transferinoutdetid");
CREATE INDEX "transferstocksinoutdet_prodcode_idx" ON "transferstocksinoutdet" ("barcode");
CREATE INDEX "transferstocksinoutdet_prodcodeno_idx" ON "transferstocksinoutdet" ("prodcodeno");
CREATE INDEX "transferstocksinoutdet_prodcodetxt_idx" ON "transferstocksinoutdet" ("prodcodetxt");
CREATE INDEX "transferstocksinoutdet_productid_idx" ON "transferstocksinoutdet" ("productid");

CREATE TABLE IF NOT EXISTS "translation"
 (
	"id"			SERIAL, 
	"ref"			VARCHAR (100), 
	"namee"			VARCHAR (75), 
	"namea"			VARCHAR (75)
);

-- CREATE INDEXES ...
CREATE INDEX "translation_id_idx" ON "translation" ("id");
ALTER TABLE "translation" ADD CONSTRAINT "translation_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "typepaywu"
 (
	"wutypeid"			SERIAL, 
	"wutypename"			VARCHAR (50), 
	"in-out"			VARCHAR (50)
);

-- CREATE INDEXES ...
ALTER TABLE "typepaywu" ADD CONSTRAINT "typepaywu_pkey" PRIMARY KEY ("wutypeid");
CREATE INDEX "typepaywu_wutypeid_idx" ON "typepaywu" ("wutypeid");

CREATE TABLE IF NOT EXISTS "unitofmeas"
 (
	"id"			SERIAL, 
	"unitname"			VARCHAR (50), 
	"descrition"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "unitofmeas_id_idx" ON "unitofmeas" ("id");
ALTER TABLE "unitofmeas" ADD CONSTRAINT "unitofmeas_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "unitofmeasrelations"
 (
	"iddd"			SERIAL, 
	"unitnamemain"			INTEGER, 
	"unitnamesecod"			INTEGER, 
	"coefnbr"			DOUBLE PRECISION
);

-- CREATE INDEXES ...
CREATE INDEX "unitofmeasrelations_iddd_idx" ON "unitofmeasrelations" ("iddd");
ALTER TABLE "unitofmeasrelations" ADD CONSTRAINT "unitofmeasrelations_pkey" PRIMARY KEY ("iddd");

CREATE TABLE IF NOT EXISTS "vatlist"
 (
	"id"			SERIAL, 
	"autono"			INTEGER, 
	"ref"			VARCHAR (50), 
	"client"			VARCHAR (50), 
	"date"			TIMESTAMP WITHOUT TIME ZONE, 
	"type"			VARCHAR (50), 
	"description"			VARCHAR (50), 
	"currency"			VARCHAR (50), 
	"amount"			REAL, 
	"vatrate"			REAL, 
	"vatamount"			REAL, 
	"note"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "vatlist_autoid_idx" ON "vatlist" ("autono");
CREATE INDEX "vatlist_id_idx" ON "vatlist" ("id");
ALTER TABLE "vatlist" ADD CONSTRAINT "vatlist_pkey" PRIMARY KEY ("id");
CREATE INDEX "vatlist_supplierid_idx" ON "vatlist" ("client");

CREATE TABLE IF NOT EXISTS "vatr"
 (
	"id"			SERIAL, 
	"vatrate"			REAL, 
	"note"			VARCHAR (50), 
	"vatrateinc"			REAL
);

-- CREATE INDEXES ...
CREATE INDEX "vatr_id_idx" ON "vatr" ("id");
ALTER TABLE "vatr" ADD CONSTRAINT "vatr_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "vatratecalc"
 (
	"iddd"			SERIAL, 
	"vaterate"			REAL, 
	"officailusd"			REAL
);

-- CREATE INDEXES ...
CREATE INDEX "vatratecalc_iddd_idx" ON "vatratecalc" ("iddd");
ALTER TABLE "vatratecalc" ADD CONSTRAINT "vatratecalc_pkey" PRIMARY KEY ("iddd");

CREATE TABLE IF NOT EXISTS "vattable"
 (
	"id"			SERIAL, 
	"vat"			REAL, 
	"note"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "vattable_id_idx" ON "vattable" ("id");
ALTER TABLE "vattable" ADD CONSTRAINT "vattable_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "wscstatement"
 (
	"id"			SERIAL, 
	"custid"			INTEGER, 
	"date"			TIMESTAMP WITHOUT TIME ZONE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"stype"			VARCHAR (50), 
	"invoiceid"			INTEGER, 
	"invtotal"			DOUBLE PRECISION, 
	"paymentid"			INTEGER, 
	"paymentamount"			DOUBLE PRECISION, 
	"paymentmethod"			INTEGER, 
	"accnow"			REAL, 
	"note"			VARCHAR (70), 
	"currency"			VARCHAR (50), 
	"checkno"			VARCHAR (50), 
	"checkdate"			DATE, 
	"checkbankname"			VARCHAR (50), 
	"vdate"			DATE, 
	"codeid"			VARCHAR (50), 
	"salesman"			INTEGER, 
	"dollarrateva"			REAL, 
	"dollarratev"			REAL, 
	"payamtusd"			DOUBLE PRECISION, 
	"payamtlbp"			DOUBLE PRECISION, 
	"accnowequiv"			REAL, 
	"payrefinv"			INTEGER, 
	"invtotalequiv"			DOUBLE PRECISION, 
	"paymentamountequiv"			DOUBLE PRECISION, 
	"custproj"			INTEGER
);
COMMENT ON COLUMN "wscstatement"."stype" IS 'Inv, Pay , CN , ..';
COMMENT ON COLUMN "wscstatement"."vdate" IS 'Value Date';
COMMENT ON COLUMN "wscstatement"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';
COMMENT ON COLUMN "wscstatement"."salesman" IS 'ExReceipt';
COMMENT ON COLUMN "wscstatement"."payrefinv" IS 'Pay No for  Inv';

-- CREATE INDEXES ...
CREATE INDEX "wscstatement_codeid_idx" ON "wscstatement" ("codeid");
CREATE INDEX "wscstatement_id_idx" ON "wscstatement" ("id");
CREATE INDEX "wscstatement_invoiceid_idx" ON "wscstatement" ("invoiceid");
CREATE INDEX "wscstatement_paymentid_idx" ON "wscstatement" ("paymentid");
ALTER TABLE "wscstatement" ADD CONSTRAINT "wscstatement_pkey" PRIMARY KEY ("id");
CREATE INDEX "wscstatement_supplierid_idx" ON "wscstatement" ("custid");

CREATE TABLE IF NOT EXISTS "wusimple"
 (
	"id"			SERIAL, 
	"branch"			VARCHAR (50), 
	"wusdate"			TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	"ref"			VARCHAR (50), 
	"type"			VARCHAR (50), 
	"comfix"			REAL, 
	"compercent"			REAL, 
	"wuinusdsim"			REAL NOT NULL, 
	"wuinllsim"			REAL NOT NULL, 
	"wuinccsim"			REAL NOT NULL, 
	"wuoutusdsim"			REAL NOT NULL, 
	"wuoutllsim"			REAL NOT NULL, 
	"wuoutccsim"			REAL NOT NULL, 
	"note"			VARCHAR (150), 
	"wustime"			TIMESTAMP WITHOUT TIME ZONE, 
	"employeeid"			INTEGER, 
	"samecurselect"			VARCHAR (50), 
	"wuinusdsimreal"			REAL, 
	"wuinllsimreal"			REAL, 
	"wuinccsimreal"			REAL, 
	"wuoutusdsimreal"			REAL, 
	"wuoutllsimreal"			REAL, 
	"wuoutccsimreal"			REAL, 
	"dollarrate"			REAL
);
COMMENT ON COLUMN "wusimple"."comfix" IS 'Fixed Commision';
COMMENT ON COLUMN "wusimple"."compercent" IS 'Percent Commision';

-- CREATE INDEXES ...
CREATE INDEX "wusimple_employeeid_idx" ON "wusimple" ("employeeid");
CREATE INDEX "wusimple_id_idx" ON "wusimple" ("id");
ALTER TABLE "wusimple" ADD CONSTRAINT "wusimple_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "aaccountsmain"
 (
	"aaccid"			SERIAL, 
	"aaccountmainno"			INTEGER, 
	"aaccountmainname"			VARCHAR (50) NOT NULL, 
	"abankname"			VARCHAR (50), 
	"account"			REAL, 
	"aaccounttype"			INTEGER, 
	"acurrency"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "aaccountsmain_bankid_idx" ON "aaccountsmain" ("aaccid");
ALTER TABLE "aaccountsmain" ADD CONSTRAINT "aaccountsmain_pkey" PRIMARY KEY ("aaccid");

CREATE TABLE IF NOT EXISTS "accounttypes"
 (
	"id"			SERIAL, 
	"accounttype"			VARCHAR (50), 
	"description"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "accounttypes_id_idx" ON "accounttypes" ("id");
ALTER TABLE "accounttypes" ADD CONSTRAINT "accounttypes_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "balancesheet01"
 (
	"iddd"			SERIAL, 
	"accountid"			INTEGER, 
	"accountno"			INTEGER, 
	"accountname"			VARCHAR (50), 
	"accountdesc"			VARCHAR (100), 
	"accounttype"			INTEGER, 
	"date1"			TIMESTAMP WITHOUT TIME ZONE, 
	"amtpos1"			REAL, 
	"amtneg1"			REAL, 
	"date2"			TIMESTAMP WITHOUT TIME ZONE, 
	"amtpos2"			REAL, 
	"amtneg2"			REAL, 
	"date3"			TIMESTAMP WITHOUT TIME ZONE, 
	"amtpos3"			REAL, 
	"amtneg3"			REAL, 
	"amtresult"			REAL, 
	"note1"			VARCHAR (50), 
	"note2"			VARCHAR (50), 
	"note3"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "balancesheet01_accountid_idx" ON "balancesheet01" ("accountid");
CREATE INDEX "balancesheet01_iddd_idx" ON "balancesheet01" ("iddd");
ALTER TABLE "balancesheet01" ADD CONSTRAINT "balancesheet01_pkey" PRIMARY KEY ("iddd");

CREATE TABLE IF NOT EXISTS "barcodedata"
 (
	"bid"			SERIAL, 
	"prodid"			INTEGER, 
	"barcodetext"			VARCHAR (50), 
	"note"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE UNIQUE INDEX "barcodedata_barcode_idx" ON "barcodedata" ("barcodetext");
CREATE INDEX "barcodedata_bid_idx" ON "barcodedata" ("bid");
ALTER TABLE "barcodedata" ADD CONSTRAINT "barcodedata_pkey" PRIMARY KEY ("bid");
CREATE INDEX "barcodedata_prodid_idx" ON "barcodedata" ("prodid");

CREATE TABLE IF NOT EXISTS "category"
 (
	"catid"			SERIAL, 
	"category"			VARCHAR (50), 
	"sortno"			INTEGER, 
	"desc"			VARCHAR (50), 
	"checkv"			BOOLEAN NOT NULL, 
	"rawmat"			BOOLEAN NOT NULL, 
	"purchaseitem"			BOOLEAN NOT NULL, 
	"solditem"			BOOLEAN NOT NULL, 
	"subitem"			BOOLEAN NOT NULL
);
COMMENT ON COLUMN "category"."rawmat" IS 'Raw Materials';

-- CREATE INDEXES ...
CREATE INDEX "category_catid_idx" ON "category" ("catid");
ALTER TABLE "category" ADD CONSTRAINT "category_pkey" PRIMARY KEY ("catid");

CREATE TABLE IF NOT EXISTS "color"
 (
	"idcolor"			SERIAL, 
	"color"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "color_idcolor_idx" ON "color" ("idcolor");
ALTER TABLE "color" ADD CONSTRAINT "color_pkey" PRIMARY KEY ("idcolor");

CREATE TABLE IF NOT EXISTS "custinvoices"
 (
	"custinvoiceid"			SERIAL, 
	"codeid"			VARCHAR (50), 
	"invid"			INTEGER, 
	"custsup"			INTEGER, 
	"customerwsid"			INTEGER, 
	"custtype"			INTEGER, 
	"projectnameinv"			TEXT, 
	"account"			DOUBLE PRECISION, 
	"status"			VARCHAR (20), 
	"custinvoicedate"			DATE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"discountinv"			REAL, 
	"vatinv"			REAL, 
	"amountinv"			REAL, 
	"notes"			VARCHAR (50), 
	"dollarrate"			REAL, 
	"insideinote"			VARCHAR (200), 
	"currency"			VARCHAR (50), 
	"duedate"			DATE, 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"salesman"			INTEGER, 
	"prevcustinvoiceid"			INTEGER, 
	"paymethod"			VARCHAR (50), 
	"amountgiven"			DOUBLE PRECISION, 
	"amountreturn"			DOUBLE PRECISION, 
	"paid"			BOOLEAN NOT NULL, 
	"payid"			INTEGER, 
	"payamount"			DOUBLE PRECISION, 
	"calced"			VARCHAR (50), 
	"qtyed"			VARCHAR (50), 
	"currency1"			INTEGER, 
	"delivery"			VARCHAR (50), 
	"transstatus"			INTEGER, 
	"stockref"			INTEGER, 
	"vatrate"			REAL, 
	"vatrateinc"			REAL, 
	"tableid"			INTEGER, 
	"tansref"			VARCHAR (50), 
	"custproj"			INTEGER, 
	"salecreatedate"			TIMESTAMP WITHOUT TIME ZONE, 
	"salestatusname"			VARCHAR (50), 
	"salestatusdate"			TIMESTAMP WITHOUT TIME ZONE
);
COMMENT ON COLUMN "custinvoices"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';
COMMENT ON COLUMN "custinvoices"."insideinote" IS 'Inside Inv  Note';
COMMENT ON COLUMN "custinvoices"."salesman" IS 'ExReceipt';

-- CREATE INDEXES ...
CREATE INDEX "custinvoices_codeid_idx" ON "custinvoices" ("codeid");
CREATE INDEX "custinvoices_customerid_idx" ON "custinvoices" ("customerwsid");
CREATE INDEX "custinvoices_employeeid_idx" ON "custinvoices" ("employeeid");
CREATE INDEX "custinvoices_invid_idx" ON "custinvoices" ("invid");
CREATE INDEX "custinvoices_jvid_idx" ON "custinvoices" ("jvid");
CREATE INDEX "custinvoices_payid_idx" ON "custinvoices" ("payid");
ALTER TABLE "custinvoices" ADD CONSTRAINT "custinvoices_pkey" PRIMARY KEY ("custinvoiceid");
CREATE INDEX "custinvoices_tableid_idx" ON "custinvoices" ("tableid");

CREATE TABLE IF NOT EXISTS "custorders"
 (
	"custordersid"			SERIAL, 
	"codeid"			VARCHAR (50), 
	"ordersid"			INTEGER, 
	"customerwsid"			INTEGER, 
	"project"			VARCHAR (70), 
	"account"			DOUBLE PRECISION, 
	"status"			VARCHAR (20), 
	"custordersdate"			DATE, 
	"deliverydate"			TIMESTAMP WITHOUT TIME ZONE, 
	"deliveredby"			VARCHAR (50), 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"discountinv"			DOUBLE PRECISION, 
	"notes"			VARCHAR (50), 
	"dollarrate"			REAL, 
	"insideonote"			VARCHAR (50), 
	"orderstatus"			VARCHAR (50), 
	"currency"			VARCHAR (50), 
	"employeeid"			INTEGER, 
	"salesman"			INTEGER, 
	"prevcustinvoiceid"			INTEGER, 
	"stockref"			INTEGER, 
	"stockstatus"			VARCHAR (50), 
	"custproj"			INTEGER, 
	"custorderamt"			REAL, 
	"custordercost"			REAL, 
	"receivedby"			VARCHAR (50)
);
COMMENT ON COLUMN "custorders"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';
COMMENT ON COLUMN "custorders"."insideonote" IS 'Inside Order Note';
COMMENT ON COLUMN "custorders"."salesman" IS 'ExReceipt';

-- CREATE INDEXES ...
CREATE INDEX "custorders_codeid_idx" ON "custorders" ("codeid");
CREATE INDEX "custorders_customerid_idx" ON "custorders" ("customerwsid");
CREATE INDEX "custorders_employeeid_idx" ON "custorders" ("employeeid");
CREATE UNIQUE INDEX "custorders_invid_idx" ON "custorders" ("ordersid");
CREATE INDEX "custorders_prevcustinvoiceid_idx" ON "custorders" ("prevcustinvoiceid");
ALTER TABLE "custorders" ADD CONSTRAINT "custorders_pkey" PRIMARY KEY ("custordersid");

CREATE TABLE IF NOT EXISTS "custproject"
 (
	"iddd"			SERIAL, 
	"customerwsid"			INTEGER, 
	"projectname"			VARCHAR (50), 
	"bbackproj"			DOUBLE PRECISION, 
	"desc"			VARCHAR (150), 
	"selectproj"			BOOLEAN NOT NULL, 
	"wsaccproj"			DOUBLE PRECISION, 
	"wsaccountproj"			DOUBLE PRECISION, 
	"wsaccequivproj"			DOUBLE PRECISION, 
	"wsaccountequivproj"			DOUBLE PRECISION
);

-- CREATE INDEXES ...
CREATE INDEX "custproject_customerwsid_idx" ON "custproject" ("customerwsid");
CREATE INDEX "custproject_iddd_idx" ON "custproject" ("iddd");
ALTER TABLE "custproject" ADD CONSTRAINT "custproject_pkey" PRIMARY KEY ("iddd");

CREATE TABLE IF NOT EXISTS "dailyrecord"
 (
	"jobrecordid"			SERIAL, 
	"dated"			DATE, 
	"employeeidd"			INTEGER, 
	"projectidd"			INTEGER, 
	"workingplaced"			INTEGER, 
	"workinghoursd"			REAL, 
	"hourrated"			DOUBLE PRECISION, 
	"activity"			VARCHAR (255), 
	"activitydetails"			VARCHAR (255), 
	"noted"			VARCHAR (100), 
	"transfer"			BOOLEAN NOT NULL, 
	"approval"			BOOLEAN NOT NULL
);

-- CREATE INDEXES ...
CREATE INDEX "dailyrecord_employeeid_idx" ON "dailyrecord" ("employeeidd");
CREATE INDEX "dailyrecord_jobrecordid_idx" ON "dailyrecord" ("jobrecordid");
ALTER TABLE "dailyrecord" ADD CONSTRAINT "dailyrecord_pkey" PRIMARY KEY ("jobrecordid");
CREATE INDEX "dailyrecord_projectid_idx" ON "dailyrecord" ("projectidd");

CREATE TABLE IF NOT EXISTS "dayss"
 (
	"idd"			SERIAL, 
	"noday"			INTEGER, 
	"day"			VARCHAR (50), 
	"dayabrv"			VARCHAR (50), 
	"dayar"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "dayss_idd_idx" ON "dayss" ("idd");
ALTER TABLE "dayss" ADD CONSTRAINT "dayss_pkey" PRIMARY KEY ("idd");

CREATE TABLE IF NOT EXISTS "employee"
 (
	"id"			SERIAL, 
	"employeename"			VARCHAR (50), 
	"salary"			REAL
);

-- CREATE INDEXES ...
CREATE INDEX "employee_id_idx" ON "employee" ("id");
ALTER TABLE "employee" ADD CONSTRAINT "employee_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "exdetails"
 (
	"id"			SERIAL, 
	"expenref"			VARCHAR (50), 
	"expdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"expense"			INTEGER, 
	"employeeid"			INTEGER, 
	"receiptname"			VARCHAR (50), 
	"exreceiptref"			INTEGER, 
	"details"			VARCHAR (150), 
	"ondate"			VARCHAR (50), 
	"expamount"			REAL, 
	"dollar"			DOUBLE PRECISION, 
	"ll"			REAL, 
	"dollarrate"			DOUBLE PRECISION, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"paymentmethod"			INTEGER, 
	"checknumber"			VARCHAR (50), 
	"bank"			VARCHAR (50), 
	"checkdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"checkpass"			VARCHAR (50), 
	"fromacc"			INTEGER, 
	"currency"			VARCHAR (50), 
	"prodid"			INTEGER, 
	"prodqty"			REAL, 
	"prodini"			REAL, 
	"produnitprice"			REAL, 
	"custid"			INTEGER, 
	"supid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"status"			VARCHAR (50), 
	"stockref"			INTEGER, 
	"dueexpamount"			REAL, 
	"ttypeexp"			VARCHAR (50), 
	"proddate"			DATE, 
	"tansref"			VARCHAR (50), 
	"purchaseinv"			INTEGER, 
	"custproj"			INTEGER, 
	"fromaaccount"			INTEGER NOT NULL
);
COMMENT ON COLUMN "exdetails"."ondate" IS 'Month Salary , ....';
COMMENT ON COLUMN "exdetails"."fromacc" IS 'To Expense';
COMMENT ON COLUMN "exdetails"."prodid" IS 'Product Exp Case';
COMMENT ON COLUMN "exdetails"."prodqty" IS 'Product Exp Case';
COMMENT ON COLUMN "exdetails"."prodini" IS 'Product Exp Case';
COMMENT ON COLUMN "exdetails"."produnitprice" IS 'Product Exp Case';
COMMENT ON COLUMN "exdetails"."custid" IS 'Product Exp Case';
COMMENT ON COLUMN "exdetails"."supid" IS 'Product Exp Case';
COMMENT ON COLUMN "exdetails"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';
COMMENT ON COLUMN "exdetails"."ttypeexp" IS 'To Choose Due or Paid : Paid / Due';
COMMENT ON COLUMN "exdetails"."fromaaccount" IS 'From Acc Paid as Expens  (Cash , Bank ,... )  not Personal acc';

-- CREATE INDEXES ...
CREATE INDEX "exdetails_bank_idx" ON "exdetails" ("bank");
CREATE INDEX "exdetails_checknumber_idx" ON "exdetails" ("checknumber");
CREATE INDEX "exdetails_codeid_idx" ON "exdetails" ("codeid");
CREATE INDEX "exdetails_custid_idx" ON "exdetails" ("custid");
CREATE INDEX "exdetails_employeeid_idx" ON "exdetails" ("employeeid");
CREATE INDEX "exdetails_id_idx" ON "exdetails" ("id");
CREATE INDEX "exdetails_jvid_idx" ON "exdetails" ("jvid");
ALTER TABLE "exdetails" ADD CONSTRAINT "exdetails_pkey" PRIMARY KEY ("id");
CREATE INDEX "exdetails_prodid_idx" ON "exdetails" ("prodid");
CREATE INDEX "exdetails_prodqty_idx" ON "exdetails" ("prodqty");
CREATE INDEX "exdetails_supid_idx" ON "exdetails" ("supid");

CREATE TABLE IF NOT EXISTS "info"
 (
	"id"			SERIAL, 
	"coname"			VARCHAR (50) NOT NULL, 
	"name"			VARCHAR (50) NOT NULL, 
	"pname"			VARCHAR (50) NOT NULL, 
	"job"			VARCHAR (100), 
	"mobile"			VARCHAR (50), 
	"phone1"			VARCHAR (50), 
	"phone2"			VARCHAR (50), 
	"cr"			VARCHAR (50), 
	"fax"			VARCHAR (50), 
	"email"			VARCHAR (50), 
	"address"			VARCHAR (50), 
	"currencymain"			VARCHAR (50), 
	"currencypurchase"			VARCHAR (50), 
	"currencysale"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "info_id_idx" ON "info" ("id");
ALTER TABLE "info" ADD CONSTRAINT "info_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "invoicedetailpre"
 (
	"invoicedetailid"			SERIAL, 
	"invoiceid"			INTEGER, 
	"productid"			INTEGER, 
	"barcode"			INTEGER, 
	"prodcodeno"			INTEGER, 
	"prodcodetxt"			INTEGER, 
	"unit"			INTEGER, 
	"box"			REAL, 
	"quantity"			DOUBLE PRECISION, 
	"lenght"			REAL, 
	"width"			REAL, 
	"meas"			REAL, 
	"price"			DOUBLE PRECISION, 
	"discount"			DOUBLE PRECISION, 
	"vat"			REAL, 
	"sn1"			VARCHAR (50), 
	"sn2"			VARCHAR (50), 
	"pricing"			BOOLEAN NOT NULL, 
	"insideidnote"			VARCHAR (50), 
	"purprice"			DOUBLE PRECISION, 
	"purcurrrate"			DOUBLE PRECISION, 
	"expenpercent1"			REAL, 
	"expenfixed1"			REAL, 
	"expenpercent2"			REAL, 
	"expenfixed2"			REAL, 
	"previnvoiceiddet"			INTEGER, 
	"stockb4"			REAL, 
	"initialpriceb4"			REAL, 
	"priceb4"			DOUBLE PRECISION, 
	"discountb4"			DOUBLE PRECISION, 
	"expenpercent1b4"			REAL, 
	"expenfixed1b4"			REAL, 
	"expenpercent2b4"			REAL, 
	"expenfixed2b4"			REAL, 
	"stockref"			INTEGER, 
	"proddate"			TIMESTAMP WITHOUT TIME ZONE
);
COMMENT ON COLUMN "invoicedetailpre"."insideidnote" IS 'Inside Inv Details Note';
COMMENT ON COLUMN "invoicedetailpre"."stockb4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoicedetailpre"."initialpriceb4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoicedetailpre"."priceb4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoicedetailpre"."discountb4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoicedetailpre"."expenpercent1b4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoicedetailpre"."expenfixed1b4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoicedetailpre"."expenpercent2b4" IS 'For Cumulative Price calculation';
COMMENT ON COLUMN "invoicedetailpre"."expenfixed2b4" IS 'For Cumulative Price calculation';

-- CREATE INDEXES ...
CREATE INDEX "invoicedetailpre_barcode_idx" ON "invoicedetailpre" ("barcode");
CREATE INDEX "invoicedetailpre_invoiceid_idx" ON "invoicedetailpre" ("invoiceid");
CREATE INDEX "invoicedetailpre_previnvoiceiddet_idx" ON "invoicedetailpre" ("previnvoiceiddet");
ALTER TABLE "invoicedetailpre" ADD CONSTRAINT "invoicedetailpre_pkey" PRIMARY KEY ("invoicedetailid");
CREATE INDEX "invoicedetailpre_prodcodeno_idx" ON "invoicedetailpre" ("prodcodeno");
CREATE INDEX "invoicedetailpre_prodcodetxt_idx" ON "invoicedetailpre" ("prodcodetxt");
CREATE INDEX "invoicedetailpre_productid_idx" ON "invoicedetailpre" ("productid");

CREATE TABLE IF NOT EXISTS "jovosub"
 (
	"jvsid"			SERIAL, 
	"jvid"			INTEGER, 
	"aaccountnomain"			INTEGER, 
	"aaccountno"			INTEGER, 
	"aaccountid"			INTEGER, 
	"aaccountname"			VARCHAR (50), 
	"curr"			VARCHAR (50), 
	"acccrdb"			VARCHAR (50), 
	"amtlbp"			REAL, 
	"amtusd"			REAL, 
	"amt"			REAL, 
	"usdlbprate"			REAL, 
	"eurusdrate"			REAL, 
	"description"			VARCHAR (100), 
	"debitamt"			REAL, 
	"creditamt"			REAL, 
	"note"			VARCHAR (100), 
	"debitamt2cur"			REAL, 
	"creditamt2cur"			REAL, 
	"employeeid"			INTEGER
);
COMMENT ON COLUMN "jovosub"."debitamt2cur" IS '2nd Currency';
COMMENT ON COLUMN "jovosub"."creditamt2cur" IS '2nd Currency';

-- CREATE INDEXES ...
CREATE INDEX "jovosub_aaccountid_idx" ON "jovosub" ("aaccountid");
CREATE INDEX "jovosub_employeeid_idx" ON "jovosub" ("employeeid");
CREATE INDEX "jovosub_jvid_idx" ON "jovosub" ("jvid");
CREATE INDEX "jovosub_jvsid_idx" ON "jovosub" ("jvsid");
ALTER TABLE "jovosub" ADD CONSTRAINT "jovosub_pkey" PRIMARY KEY ("jvsid");

CREATE TABLE IF NOT EXISTS "levelingprod"
 (
	"levelingid"			SERIAL, 
	"levelingref"			VARCHAR (50), 
	"levelingoperator"			VARCHAR (50), 
	"levelingdate"			DATE, 
	"levelingtime"			TIMESTAMP WITHOUT TIME ZONE, 
	"notes"			VARCHAR (50), 
	"dollarrate"			REAL, 
	"levelingamount"			REAL, 
	"levelingvat"			REAL, 
	"insideinote"			VARCHAR (50), 
	"currency"			VARCHAR (50), 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"status"			VARCHAR (20), 
	"stockref"			INTEGER
);
COMMENT ON COLUMN "levelingprod"."levelingvat" IS 'VAT %';
COMMENT ON COLUMN "levelingprod"."insideinote" IS 'Inside Inv Note';
COMMENT ON COLUMN "levelingprod"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "levelingprod_codeid_idx" ON "levelingprod" ("codeid");
CREATE INDEX "levelingprod_employeeid_idx" ON "levelingprod" ("employeeid");
CREATE INDEX "levelingprod_jvid_idx" ON "levelingprod" ("jvid");
ALTER TABLE "levelingprod" ADD CONSTRAINT "levelingprod_pkey" PRIMARY KEY ("levelingid");

CREATE TABLE IF NOT EXISTS "monthname"
 (
	"monnthid"			SERIAL, 
	"monthname"			VARCHAR (50), 
	"fullname"			VARCHAR (50), 
	"note"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "monthname_monnthid_idx" ON "monthname" ("monnthid");
ALTER TABLE "monthname" ADD CONSTRAINT "monthname_pkey" PRIMARY KEY ("monnthid");

CREATE TABLE IF NOT EXISTS "paytypetable"
 (
	"id"			SERIAL, 
	"paytype"			VARCHAR (50), 
	"payname"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "paytypetable_id_idx" ON "paytypetable" ("id");
ALTER TABLE "paytypetable" ADD CONSTRAINT "paytypetable_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "prodlocationname"
 (
	"idddd"			SERIAL, 
	"locationname"			VARCHAR (70), 
	"locationnote"			VARCHAR (50)
);

-- CREATE INDEXES ...
CREATE INDEX "prodlocationname_idddd_idx" ON "prodlocationname" ("idddd");
ALTER TABLE "prodlocationname" ADD CONSTRAINT "prodlocationname_pkey" PRIMARY KEY ("idddd");
CREATE INDEX "prodlocationname_prodid_idx" ON "prodlocationname" ("locationname");

CREATE TABLE IF NOT EXISTS "productiondetails"
 (
	"prodetailid"			SERIAL, 
	"proid"			INTEGER, 
	"productid"			INTEGER, 
	"prodcodeno"			INTEGER, 
	"prodcodetxt"			INTEGER, 
	"barcode"			INTEGER, 
	"unit"			INTEGER, 
	"jalekh"			BOOLEAN NOT NULL, 
	"shateb"			BOOLEAN NOT NULL, 
	"sand"			BOOLEAN NOT NULL, 
	"quantity"			REAL, 
	"lenght"			REAL, 
	"width"			REAL, 
	"meas"			REAL, 
	"proprodprice"			REAL, 
	"price1"			REAL, 
	"price2"			REAL, 
	"discount"			REAL, 
	"sn1"			VARCHAR (50), 
	"note"			VARCHAR (150), 
	"insidenote"			VARCHAR (50), 
	"orderid"			INTEGER, 
	"itemsaledate"			DATE, 
	"measoflwq1"			REAL, 
	"stockref"			INTEGER
);
COMMENT ON COLUMN "productiondetails"."jalekh" IS '--';
COMMENT ON COLUMN "productiondetails"."shateb" IS '--';
COMMENT ON COLUMN "productiondetails"."sand" IS '---------';
COMMENT ON COLUMN "productiondetails"."insidenote" IS 'Inside  Details Note';
COMMENT ON COLUMN "productiondetails"."measoflwq1" IS 'Lenght * Width *Quantity1';

-- CREATE INDEXES ...
CREATE INDEX "productiondetails_custinvoicedetailid_idx" ON "productiondetails" ("prodetailid");
CREATE INDEX "productiondetails_custinvoiceid_idx" ON "productiondetails" ("proid");
CREATE INDEX "productiondetails_orderid_idx" ON "productiondetails" ("orderid");
ALTER TABLE "productiondetails" ADD CONSTRAINT "productiondetails_pkey" PRIMARY KEY ("prodetailid");
CREATE INDEX "productiondetails_prodcode_idx" ON "productiondetails" ("barcode");
CREATE INDEX "productiondetails_prodcodeno_idx" ON "productiondetails" ("prodcodeno");
CREATE INDEX "productiondetails_prodcodetxt_idx" ON "productiondetails" ("prodcodetxt");
CREATE INDEX "productiondetails_productid_idx" ON "productiondetails" ("productid");

CREATE TABLE IF NOT EXISTS "receiptstatement"
 (
	"id"			SERIAL, 
	"receiptname"			INTEGER, 
	"commission"			REAL, 
	"customerid"			INTEGER, 
	"date"			TIMESTAMP WITHOUT TIME ZONE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"invoiceid"			INTEGER, 
	"clientinvref"			VARCHAR (50), 
	"invtotal"			DOUBLE PRECISION, 
	"paymentid"			INTEGER, 
	"clientpayref"			VARCHAR (50), 
	"paymentamount"			DOUBLE PRECISION, 
	"accnow"			REAL, 
	"type"			VARCHAR (50), 
	"commtype"			VARCHAR (50), 
	"currency"			VARCHAR (50), 
	"commamount"			DOUBLE PRECISION
);

-- CREATE INDEXES ...
CREATE INDEX "receiptstatement_customerid_idx" ON "receiptstatement" ("customerid");
CREATE INDEX "receiptstatement_id_idx" ON "receiptstatement" ("id");
CREATE INDEX "receiptstatement_invoiceid_idx" ON "receiptstatement" ("invoiceid");
CREATE INDEX "receiptstatement_paymentid_idx" ON "receiptstatement" ("paymentid");
ALTER TABLE "receiptstatement" ADD CONSTRAINT "receiptstatement_pkey" PRIMARY KEY ("id");
CREATE INDEX "receiptstatement_supplierid_idx" ON "receiptstatement" ("receiptname");

CREATE TABLE IF NOT EXISTS "salarystatement"
 (
	"id"			SERIAL, 
	"ref"			VARCHAR (50), 
	"transdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"expense"			INTEGER, 
	"employeeid"			INTEGER, 
	"receiptname"			VARCHAR (50), 
	"exreceiptref"			INTEGER, 
	"details"			VARCHAR (150), 
	"ondate"			VARCHAR (50), 
	"expamount"			REAL, 
	"expamtusd"			REAL, 
	"expamtlbp"			REAL, 
	"transtime"			TIMESTAMP WITHOUT TIME ZONE, 
	"paymentmethod"			INTEGER, 
	"checknumber"			VARCHAR (50), 
	"bank"			VARCHAR (50), 
	"checkdate"			TIMESTAMP WITHOUT TIME ZONE, 
	"checkpass"			VARCHAR (50), 
	"currency"			VARCHAR (50), 
	"status"			VARCHAR (50), 
	"stockref"			INTEGER, 
	"dueamount"			REAL, 
	"dueamtusd"			REAL, 
	"dueamtlbp"			REAL, 
	"ttypeexp"			VARCHAR (50), 
	"salesamt"			REAL, 
	"employeecomm"			REAL, 
	"dollarrate"			REAL
);
COMMENT ON COLUMN "salarystatement"."ondate" IS 'Month Salary , ....';
COMMENT ON COLUMN "salarystatement"."ttypeexp" IS 'To Choose Due or Paid : Paid / Due';

-- CREATE INDEXES ...
CREATE INDEX "salarystatement_bank_idx" ON "salarystatement" ("bank");
CREATE INDEX "salarystatement_checknumber_idx" ON "salarystatement" ("checknumber");
CREATE INDEX "salarystatement_employeeid_idx" ON "salarystatement" ("employeeid");
CREATE INDEX "salarystatement_id_idx" ON "salarystatement" ("id");
ALTER TABLE "salarystatement" ADD CONSTRAINT "salarystatement_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "smsdatatble"
 (
	"smsdata"			TEXT
);

-- CREATE INDEXES ...

CREATE TABLE IF NOT EXISTS "suporderdet"
 (
	"orderdetailid"			SERIAL, 
	"orderid"			INTEGER, 
	"productid"			INTEGER, 
	"barcode"			INTEGER, 
	"prodcodeno"			INTEGER, 
	"prodcodetxt"			INTEGER, 
	"unit"			INTEGER, 
	"box"			REAL, 
	"quantity"			DOUBLE PRECISION, 
	"lenght"			REAL, 
	"width"			REAL, 
	"price"			DOUBLE PRECISION, 
	"discount"			DOUBLE PRECISION, 
	"vat"			REAL, 
	"insideidnote"			VARCHAR (50), 
	"purprice"			DOUBLE PRECISION, 
	"purcurrrate"			DOUBLE PRECISION, 
	"previnvoiceiddet"			INTEGER, 
	"stockref"			INTEGER, 
	"proddate"			DATE
);
COMMENT ON COLUMN "suporderdet"."insideidnote" IS 'Inside Inv Details Note';

-- CREATE INDEXES ...
CREATE INDEX "suporderdet_invoiceid_idx" ON "suporderdet" ("orderid");
CREATE INDEX "suporderdet_previnvoiceid_idx" ON "suporderdet" ("previnvoiceiddet");
ALTER TABLE "suporderdet" ADD CONSTRAINT "suporderdet_pkey" PRIMARY KEY ("orderdetailid");
CREATE INDEX "suporderdet_prodcode_idx" ON "suporderdet" ("barcode");
CREATE INDEX "suporderdet_prodcodeno_idx" ON "suporderdet" ("prodcodeno");
CREATE INDEX "suporderdet_prodcodetxt_idx" ON "suporderdet" ("prodcodetxt");
CREATE INDEX "suporderdet_productid_idx" ON "suporderdet" ("productid");

CREATE TABLE IF NOT EXISTS "supstatement"
 (
	"id"			SERIAL, 
	"supplierid"			INTEGER, 
	"date"			TIMESTAMP WITHOUT TIME ZONE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"invoiceid"			INTEGER, 
	"supinvoiceno"			VARCHAR (50), 
	"invtotal"			DOUBLE PRECISION, 
	"paymentid"			INTEGER, 
	"paymentamount"			DOUBLE PRECISION, 
	"paymentmethod"			INTEGER, 
	"accnow"			REAL, 
	"currency"			VARCHAR (50), 
	"codeid"			VARCHAR (50), 
	"stype"			VARCHAR (50), 
	"note"			VARCHAR (70), 
	"checkno"			VARCHAR (50), 
	"checkdate"			DATE, 
	"checkbankname"			VARCHAR (50), 
	"vdate"			DATE, 
	"dollarratev"			REAL, 
	"payamtusd"			DOUBLE PRECISION, 
	"payamtlbp"			DOUBLE PRECISION
);
COMMENT ON COLUMN "supstatement"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';
COMMENT ON COLUMN "supstatement"."stype" IS 'Inv, Pay , CN , ..';
COMMENT ON COLUMN "supstatement"."vdate" IS 'Value Date';

-- CREATE INDEXES ...
CREATE INDEX "supstatement_codeid_idx" ON "supstatement" ("codeid");
CREATE INDEX "supstatement_id_idx" ON "supstatement" ("id");
CREATE INDEX "supstatement_invoiceid_idx" ON "supstatement" ("invoiceid");
CREATE INDEX "supstatement_paymentid_idx" ON "supstatement" ("paymentid");
ALTER TABLE "supstatement" ADD CONSTRAINT "supstatement_pkey" PRIMARY KEY ("id");
CREATE INDEX "supstatement_supplierid_idx" ON "supstatement" ("supplierid");

CREATE TABLE IF NOT EXISTS "testingfraction"
 (
	"id"			SERIAL, 
	"lsin2"			REAL, 
	"lsinauto"			REAL
);

-- CREATE INDEXES ...
CREATE INDEX "testingfraction_id_idx" ON "testingfraction" ("id");
ALTER TABLE "testingfraction" ADD CONSTRAINT "testingfraction_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "transferstocksinout"
 (
	"transferinoutid"			SERIAL, 
	"transfertype"			VARCHAR (50), 
	"transferinoutref"			VARCHAR (50), 
	"refname"			VARCHAR (50), 
	"refnameid"			INTEGER, 
	"enteringinoutdatetime"			TIMESTAMP WITHOUT TIME ZONE, 
	"transferinoutdate"			DATE, 
	"transferinouttime"			TIMESTAMP WITHOUT TIME ZONE, 
	"transferinoutfromstock"			INTEGER, 
	"transferinouttostock"			INTEGER, 
	"notes"			VARCHAR (150), 
	"dollarrate"			REAL, 
	"transferamount"			REAL, 
	"transfervat"			REAL, 
	"insideinote"			VARCHAR (150), 
	"currency"			VARCHAR (50), 
	"employeeid"			INTEGER, 
	"trans2acc"			VARCHAR (10), 
	"jvid"			INTEGER, 
	"codeid"			VARCHAR (50), 
	"status"			VARCHAR (20), 
	"stockref"			INTEGER
);
COMMENT ON COLUMN "transferstocksinout"."transfertype" IS 'In / out';
COMMENT ON COLUMN "transferstocksinout"."transferinoutref" IS 'For Transfer toStock From/To  outside Stock/Client';
COMMENT ON COLUMN "transferstocksinout"."transfervat" IS 'VAT %';
COMMENT ON COLUMN "transferstocksinout"."insideinote" IS 'Inside Inv Note';
COMMENT ON COLUMN "transferstocksinout"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "transferstocksinout_codeid_idx" ON "transferstocksinout" ("codeid");
CREATE INDEX "transferstocksinout_employeeid_idx" ON "transferstocksinout" ("employeeid");
CREATE INDEX "transferstocksinout_jvid_idx" ON "transferstocksinout" ("jvid");
ALTER TABLE "transferstocksinout" ADD CONSTRAINT "transferstocksinout_pkey" PRIMARY KEY ("transferinoutid");

CREATE TABLE IF NOT EXISTS "userslogs"
 (
	"id"			SERIAL, 
	"username"			VARCHAR (50), 
	"login"			TIMESTAMP WITHOUT TIME ZONE, 
	"logout"			TIMESTAMP WITHOUT TIME ZONE, 
	"note"			VARCHAR (50), 
	"codeid"			VARCHAR (50)
);
COMMENT ON COLUMN "userslogs"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';

-- CREATE INDEXES ...
CREATE INDEX "userslogs_codeid_idx" ON "userslogs" ("codeid");
CREATE INDEX "userslogs_id_idx" ON "userslogs" ("id");
ALTER TABLE "userslogs" ADD CONSTRAINT "userslogs_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "wscstatement1st"
 (
	"id"			SERIAL, 
	"custid"			INTEGER, 
	"date"			TIMESTAMP WITHOUT TIME ZONE, 
	"time"			TIMESTAMP WITHOUT TIME ZONE, 
	"stype"			VARCHAR (50), 
	"invoiceid"			INTEGER, 
	"invtotal"			DOUBLE PRECISION, 
	"paymentid"			INTEGER, 
	"paymentamount"			DOUBLE PRECISION, 
	"paymentmethod"			INTEGER, 
	"accnow"			REAL, 
	"note"			VARCHAR (70), 
	"currency"			VARCHAR (50), 
	"checkno"			VARCHAR (50), 
	"checkdate"			DATE, 
	"checkbankname"			VARCHAR (50), 
	"vdate"			DATE, 
	"codeid"			VARCHAR (50), 
	"salesman"			INTEGER, 
	"dollarratev"			REAL, 
	"payamtusd"			DOUBLE PRECISION, 
	"payamtlbp"			DOUBLE PRECISION, 
	"accnowequiv"			REAL, 
	"payrefinv"			INTEGER, 
	"invtotalequiv"			DOUBLE PRECISION, 
	"paymentamountequiv"			DOUBLE PRECISION, 
	"custproj"			INTEGER
);
COMMENT ON COLUMN "wscstatement1st"."stype" IS 'Inv, Pay , CN , ..';
COMMENT ON COLUMN "wscstatement1st"."vdate" IS 'Value Date';
COMMENT ON COLUMN "wscstatement1st"."codeid" IS 'Code to Seprate between Main , SalesMan , Store ...';
COMMENT ON COLUMN "wscstatement1st"."salesman" IS 'ExReceipt';
COMMENT ON COLUMN "wscstatement1st"."payrefinv" IS 'Pay No for  Inv';

-- CREATE INDEXES ...
CREATE INDEX "wscstatement1st_codeid_idx" ON "wscstatement1st" ("codeid");
CREATE INDEX "wscstatement1st_id_idx" ON "wscstatement1st" ("id");
CREATE INDEX "wscstatement1st_invoiceid_idx" ON "wscstatement1st" ("invoiceid");
CREATE INDEX "wscstatement1st_paymentid_idx" ON "wscstatement1st" ("paymentid");
ALTER TABLE "wscstatement1st" ADD CONSTRAINT "wscstatement1st_pkey" PRIMARY KEY ("id");
CREATE INDEX "wscstatement1st_supplierid_idx" ON "wscstatement1st" ("custid");


-- CREATE Relationships ...
ALTER TABLE "CustInvStockDetails" ADD CONSTRAINT "custinvstockdetails_custinvstockid_fk" FOREIGN KEY ("custinvstockid") REFERENCES "CustSInvStock"("custinvstockid") ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "ConsProdDet" ADD CONSTRAINT "consproddet_consid_fk" FOREIGN KEY ("consid") REFERENCES "ConsProd"("consid") ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "CustInvoiceDetails" ADD CONSTRAINT "custinvoicedetails_custinvoiceid_fk" FOREIGN KEY ("custinvoiceid") REFERENCES "CustInvoices"("custinvoiceid") ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "Invoice Details" ADD CONSTRAINT "invoice details_invoiceid_fk" FOREIGN KEY ("invoiceid") REFERENCES "Invoices"("invoiceid") ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "OrderDetails" ADD CONSTRAINT "orderdetails_orderid_fk" FOREIGN KEY ("orderid") REFERENCES "Orders"("orderid") ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;
