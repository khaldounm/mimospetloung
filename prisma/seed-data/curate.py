"""Curate GT_Data26 clients + pets into a resolved seed dataset.

Decisions are baked in here once; the emitted JSON carries final values, so no
heuristic runs at seed time.
"""
import csv, json, re, collections, unicodedata

SRC = "cust.csv"
OUT = "out/"

# ---------------------------------------------------------------- name splitting
# Learned from the 311 rows where staff filled ContactFirstName/ContactLastName.
PARTICLES = {"al","el","l","abi","abu","abou","abo","abed","abdel","bou","bu","bin","ibn","ab"}
# Titles typed into the name field. The trailing period is load-bearing: without
# it this also eats the real client name "Engrid Saad".
NO_NAME = "(no name)"
TITLE = re.compile(r"^(dr|mr|mrs|miss|ms|eng|sheikh|messrs|prof|madam)\.\s*", re.I)
BARE_TITLE = re.compile(r"^(madam|sheikh)\s+", re.I)
SALUT = {"mr":"Mr.","mrs":"Mrs.","miss":"Miss","ms":"Ms.","dr":"Dr.","eng":"Eng.",
         "sheikh":"Sheikh","messrs":"Messrs.","prof":"Prof.","madam":"Madam"}
# BName column. Arabic titles and the 'cas' placeholder ("cash", a walk-in marker).
BNAME_MAP = {"mr.":"Mr.","dr.":"Dr.","miss":"Miss","mrs.":"Mrs.",
             "السيد":"Mr.","السيدة":"Mrs.","الشيخ":"Sheikh","cas":None}

def titlecase(n):
    """Title-case without destroying internal capitals staff typed deliberately."""
    out=[]
    for w in n.split():
        if w.isupper() and len(w)>3: w=w.capitalize()
        elif w.islower(): w=w.capitalize()
        out.append(w)
    return " ".join(out)

def _key(s): return re.sub(r"[^a-z]", "", (s or "").lower())

def split_name(full, cfirst, clast):
    """Return (first, last, confident, conflict).

    ContactFirstName/ContactLastName are staff-entered and usually authoritative,
    but on 14 rows they are stale leftovers naming a different person entirely
    (a company name carrying the contact details of an unrelated person).
    Use them only when they
    corroborate or enrich the name field; otherwise keep the name the clinic
    sees and report the conflict.
    """
    conflict = None
    cfirst = TITLE.sub("", cfirst or "").strip()
    clast = (clast or "").strip()
    if cfirst or clast:
        ck, fk = _key(cfirst + clast), _key(full)
        if ck == fk and clast:
            return titlecase(cfirst), titlecase(clast), True, None
        if fk and fk in ck and clast:        # contact adds a missing surname
            return titlecase(cfirst), titlecase(clast), True, None
        if ck == fk and not clast:
            # Whole name sat in ContactFirstName; fall through to the particle
            # split rather than leaving lastName empty.
            pass
        elif ck and ck in fk:
            # Contact holds only part of the name -- ignore it, keep the full name.
            pass
        else:
            conflict = (f'The old system also recorded this client as '
                        f'"{(cfirst + " " + clast).strip()}"; confirm which is right.')
    if not (cfirst or clast):
        conflict = None
    if full == NO_NAME: return NO_NAME, "", True, conflict
    t = full.split()
    if not t: return "", "", False, conflict
    if len(t) == 1: return titlecase(t[0]), "", False, conflict
    # Walk from token 1: everything from the first particle onward is the surname.
    for i in range(1, len(t)):
        if t[i].lower().strip(".") in PARTICLES:
            return titlecase(" ".join(t[:i])), titlecase(" ".join(t[i:])), True, conflict
    return titlecase(t[0]), titlecase(" ".join(t[1:])), len(t) == 2, conflict

# ---------------------------------------------------------------- pets
BREEDS = {
    "bichon":"Dog","husky":"Dog","poodle":"Dog","loulou":"Dog","pomi":"Dog","pom":"Dog",
    "pomeranian":"Dog","poma":"Dog","spitz":"Dog","labrador":"Dog","golden retriever":"Dog",
    "retriever":"Dog","malinois":"Dog","pitbull":"Dog","pit bull":"Dog","german shepherd":"Dog",
    "german":"Dog","shepherd":"Dog","rottweiler":"Dog","chihuahua":"Dog","maltese":"Dog",
    "akita":"Dog","labrakita":"Dog","yorky":"Dog","yorkshire":"Dog","puggy":"Dog","pug":"Dog",
    "boxer":"Dog","beagle":"Dog","terrier":"Dog","doberman":"Dog","collie":"Dog","bulldog":"Dog",
    "dachshund":"Dog","corgi":"Dog","chow":"Dog","samoyed":"Dog","griffon":"Dog","saluki":"Dog",
    "shih tzu":"Dog","shitzu":"Dog","mixed german shepherd":"Dog","mixed husky":"Dog",
    "persian":"Cat","shirazi":"Cat","siamese":"Cat","angora":"Cat","sphynx":"Cat","bengal":"Cat",
    "ragdoll":"Cat","himalayan":"Cat","calico":"Cat","tabby":"Cat","munchkin":"Cat",
    "british":"Cat","scottish":"Cat","scottish fold":"Cat",
}
# Breed words that carry no species on their own.
BREED_NEUTRAL = {"mixed","mix","mixed breed","stray","street"}
SPECIES_WORD = {
    "cat":"Cat","cats":"Cat","kitten":"Cat","kittens":"Cat","kitty cat":"Cat",
    "big cats":"Cat","fluffy cat":"Cat","white cat":"Cat","stray cat":"Cat","street cat":"Cat",
    "dog":"Dog","dogs":"Dog","puppy":"Dog","puppies":"Dog","fluffy dog":"Dog",
    "bird":"Bird","birds":"Bird","parrot":"Bird","rabbit":"Rabbit","rabbits":"Rabbit",
    "turtle":"Reptile","hamster":"Small mammal","fish":"Fish",
}
SEX_WORD = {"male":"Male","female":"Female"}
# Separators. NOTE: " - " is deliberately NOT here -- in this data it means
# "breed - name", not "pet and pet". Splitting on it invented 24 phantom pets.
PET_SEP = re.compile(r"[\n\r/&,]|\+")
QTY = re.compile(r"\s*[xX](\d+)\s*$")

def norm(s): return re.sub(r"\s+"," ",(s or "").strip())

def longest_breed(text):
    """Longest breed phrase appearing in text -> (phrase, species) or None."""
    low = text.lower()
    best = None
    for b in list(BREEDS) + list(BREED_NEUTRAL):
        if re.search(rf"\b{re.escape(b)}\b", low):
            if best is None or len(b) > len(best): best = b
    if best is None: return None
    return best, BREEDS.get(best)

def parse_pet(seg):
    """One segment -> list of pet dicts (a segment can carry a quantity)."""
    seg = norm(seg)
    if not seg: return []
    count = 1
    m = QTY.search(seg)
    if m:
        count = int(m.group(1)); seg = QTY.sub("", seg).strip()

    name, breed, species, sex, note = None, None, None, None, None

    # "BREED - NAME" / "BREED - SEX"
    parts = re.split(r"\s+-\s+", seg, maxsplit=1)
    if len(parts) == 2:
        left, right = norm(parts[0]), norm(parts[1])
        lb, rb = longest_breed(left), longest_breed(right)
        if lb and not rb:
            breed, species = lb[0], lb[1]
            if right.lower() in SEX_WORD: sex = SEX_WORD[right.lower()]
            elif right.lower() in SPECIES_WORD: species = SPECIES_WORD[right.lower()] or species
            else: name = right
        elif rb and not lb:
            breed, species, name = rb[0], rb[1], left
        elif (left.lower() in SPECIES_WORD or right.lower() in SPECIES_WORD
              or left.lower() in SEX_WORD or right.lower() in SEX_WORD):
            # e.g. "Dog - Large Breed": description on both sides, one animal.
            sp = SPECIES_WORD.get(left.lower()) or SPECIES_WORD.get(right.lower())
            return [{"name": "Unnamed Pet", "breed": None, "species": sp,
                     "sex": SEX_WORD.get(left.lower()) or SEX_WORD.get(right.lower()),
                     "review": f'Owner record said "{seg}" where a pet name should be.',
                     "source": seg}]
        else:
            # Two names, or two breeds -- treat as two pets, flagged.
            return [{"name": left, "breed": None, "species": None, "sex": None,
                     "review": f'Ambiguous entry "{seg}"; confirm this is two pets.',
                     "source": seg},
                    {"name": right, "breed": None, "species": None, "sex": None,
                     "review": f'Ambiguous entry "{seg}"; confirm this is two pets.',
                     "source": seg}]
    else:
        b = longest_breed(seg)
        if b:
            bname, bspec = b
            breed, species = bname, bspec
            leftover = norm(re.sub(rf"\b{re.escape(bname)}\b", " ", seg, flags=re.I))
            leftover = norm(re.sub(r"\b(mixed|mix|breed|stray|street)\b"," ",leftover,flags=re.I))
            if leftover and leftover.lower() not in SPECIES_WORD and leftover.lower() not in SEX_WORD:
                name = leftover
            elif leftover.lower() in SPECIES_WORD:
                species = SPECIES_WORD[leftover.lower()] or species
        elif seg.lower() in SPECIES_WORD:
            species = SPECIES_WORD[seg.lower()]
        elif seg.lower() in SEX_WORD:
            sex = SEX_WORD[seg.lower()]
        else:
            name = seg

    if breed: breed = titlecase(breed)
    out = []
    for i in range(count):
        review = None
        nm = name
        if not nm:
            nm = "Unnamed Pet"
            review = f'Owner record said "{seg}" where a pet name should be.'
        elif count > 1:
            review = f'"{seg}" recorded {count} animals; names were not given individually.'
        out.append({"name": titlecase(nm)[:100], "breed": breed, "species": species,
                    "sex": sex, "review": review, "source": seg})
    return out

# Four owner records use a tight hyphen ("Junior-June-Spicy") to mean several
# pets, the exact inverse of the spaced " - " that means breed-name. That is
# too few to justify a rule, and a rule would misfire on hyphenated names, so
# they are listed outright. Keyed by CustomerWSID.
PET_OVERRIDES = {
    583: [{"name": "Butter"}, {"name": "Grace"}, {"name": "Danab Maksur"},
          {"name": "Junior"}, {"name": "June"}, {"name": "Spicy"},
          {"name": "Storm"}],
    1423: [{"name": "Whizzy"}, {"name": "Sparta"}],
    1522: [{"name": "Oscar", "species": "Dog"}, {"name": "Oscar", "species": "Cat"}],
    1590: [{"name": "Grey"}, {"name": "Pixel"}],
}

# ---------------------------------------------------------------- phones
def clean_phone(p):
    p = re.sub(r"\D", "", p or "")
    if not p or p == "0" or len(p) < 6: return None
    if p.startswith("961"): p = p[3:]
    return p[:20] or None

# ---------------------------------------------------------------- run
rows = list(csv.DictReader(open(SRC)))
def g(r, k): return (r[k] or "").strip()

# Any client that ever transacted is real, whatever its name column says.
TRANSACTED = {(x["CustomerWSID"] or "").strip()
              for x in csv.DictReader(open("inv.csv"))}

clients, patients = [], []
dropped, stats = [], collections.Counter()

for r in rows:
    cid = int(g(r, "CustomerWSID"))
    raw = norm(g(r, "CustWholeSaleName"))
    raw = raw.replace("|", " ").replace("\\n", " ")
    raw = norm(raw)
    notes_raw = g(r, "Notes")
    balance = float(g(r, "WSAccount") or 0)
    phone, phone2 = clean_phone(g(r, "PhoneNumber")), clean_phone(g(r, "FaxNumber"))
    if phone2 and phone2 == phone: phone2 = None
    if phone2 and phone and (phone2.lstrip("0").startswith(phone.lstrip("0")[:7])
                             or phone.lstrip("0").startswith(phone2.lstrip("0")[:7])):
        phone2 = None
    if phone is None and phone2: phone, phone2 = phone2, None
    reviews = []

    # Drop only rows that are junk on every axis. Zero invoices is NOT a signal:
    # this file is 2026 only, so prior-year clients legitimately have none.
    if (not raw and not notes_raw and balance == 0 and not phone
            and not phone2 and str(cid) not in TRANSACTED):
        dropped.append({"legacyId": cid, "reason": "empty placeholder row"})
        stats["dropped"] += 1
        continue

    salutation = BNAME_MAP.get(g(r, "BName").lower().strip(), None)
    m = TITLE.match(raw)
    if m:
        salutation = salutation or SALUT[m.group(1).lower()]
        raw = norm(TITLE.sub("", raw))
    m2 = BARE_TITLE.match(raw)
    if m2:
        salutation = salutation or SALUT[m2.group(1).lower()]
        raw = norm(BARE_TITLE.sub("", raw))

    if re.fullmatch(r"[\d\W]+", raw or "x"):
        reviews.append(f'Name in the old system was "{raw or "(blank)"}"; needs a real name.')
        raw = raw or "(no name)"
        stats["junk_name"] += 1
    if not raw:
        raw = "(no name)"
        reviews.append("The old system had no name for this client.")
        stats["nameless_kept"] += 1

    # A slash or ampersand in the FIRST token ("<first>/<first> <surname>")
    # means two people share one account. They stay a single client -- the
    # balance belongs to the account, not to a person -- but the name is
    # reduced to the first of them and the second is recorded in the note.
    # A slash in a LATER token is the other pattern: one person carrying two
    # surnames, maiden and married. That is left alone and only flagged.
    second_person = None
    toks = raw.split()
    if toks and re.search(r"[&/]", toks[0]):
        people = [p.strip() for p in re.split(r"[&/]", toks[0]) if p.strip()]
        if len(people) > 1:
            second_person = ", ".join(people[1:])
            raw = " ".join([people[0]] + toks[1:])
    elif re.search(r"\s[&/]\s|\S[&/]\S", raw) and re.search(r"[&/]", raw):
        second_person = None
        reviews.append(
            f'The old system recorded this client as "{norm(g(r, "CustWholeSaleName"))}"; '
            f"confirm whether that is one person or two."
        )
        stats["two_people"] += 1
        raw = norm(re.sub(r"\s*[&/]\s*", " ", raw))

    if second_person:
        reviews.append(
            f'This record also covers {second_person}. Confirm whether they '
            f"should be a separate client."
        )
        stats["two_people"] += 1

    first, last, confident, conflict = split_name(
        raw, g(r, "ContactFirstName"), g(r, "ContactLastName"))
    if conflict:
        reviews.append(conflict); stats["name_conflict"] += 1
    if not confident and last:
        reviews.append(f'Name "{raw}" was split as {first} / {last}; confirm the surname.')
        stats["split_uncertain"] += 1
    if g(r, "ContactFirstName") or g(r, "ContactLastName"): stats["split_from_staff"] += 1

    insured = g(r, "Insured")
    note_bits = []
    if insured and insured != "No": note_bits.append(f"Insurance: {insured}")
    if g(r, "DOB"): note_bits.append(f"Last visit in the old system: {g(r,'DOB')[:8]}")

    clients.append({
        "legacyId": cid, "salutation": salutation, "firstName": first[:100],
        "lastName": last[:100], "accountBalance": round(balance, 2) + 0.0,
        "phone": phone, "phone2": phone2,
        "email": (g(r, "EmailAddress") or None),
        "notes": ("\n".join(note_bits) or None),
        "needsReview": bool(reviews), "reviewNote": (" ".join(reviews) or None),
    })
    stats["clients"] += 1

    if notes_raw and cid != 1:
        idx = 0
        if cid in PET_OVERRIDES:
            pets_here = [{"name": o["name"], "species": o.get("species"),
                          "breed": o.get("breed"), "sex": o.get("sex"),
                          "review": None} for o in PET_OVERRIDES[cid]]
            stats["pets_from_override"] += len(pets_here)
        else:
            pets_here = [p for seg in PET_SEP.split(notes_raw)
                         for p in parse_pet(seg)]
        for seg in [None]:
            for pet in pets_here:
                patients.append({
                    "legacyId": cid * 100 + idx, "clientLegacyId": cid,
                    "name": pet["name"], "species": pet["species"], "breed": pet["breed"],
                    "sex": pet["sex"],
                    "notes": f'Imported from the old system: "{norm(notes_raw)}"',
                    "needsReview": bool(pet["review"]), "reviewNote": pet["review"],
                })
                idx += 1
                stats["patients"] += 1
                if pet["review"]: stats["patients_flagged"] += 1
                if pet["species"]: stats["patients_with_species"] += 1
                if pet["breed"]: stats["patients_with_breed"] += 1

# ---------------------------------------------------------------- duplicates
# Shared phone is a far stronger signal than name similarity: it catches the
# Arabizi respellings (the same name written with and without the digits
# that stand in for Arabic letters) that no string
# distance on the surname would group. Same phone + same first name = very
# likely one person entered twice; same phone + different first name = a
# household, which must NOT be merged.
by_phone = collections.defaultdict(list)
for c in clients:
    if c["phone"]: by_phone[c["phone"]].append(c)

for phone, group in by_phone.items():
    if len(group) < 2: continue
    by_first = collections.defaultdict(list)
    for c in group: by_first[_key(c["firstName"])[:4]].append(c)
    for _, same in by_first.items():
        if len(same) < 2: continue
        for c in same:
            others = ", ".join(
                f"#{o['legacyId']} {o['firstName']} {o['lastName']}".strip()
                for o in same if o is not c)
            msg = (f"Shares a phone number and first name with {others}. "
                   f"Likely the same person recorded more than once - merge or "
                   f"keep separate before using either record.")
            c["reviewNote"] = f"{c['reviewNote']} {msg}" if c["reviewNote"] else msg
            c["needsReview"] = True
            stats["dup_candidates"] += 1
    if len(by_first) > 1:
        for c in group:
            hh = ", ".join(f"#{o['legacyId']} {o['firstName']} {o['lastName']}".strip()
                           for o in group if o is not c)
            msg = f"Shares a phone number with {hh} (probably the same household)."
            c["reviewNote"] = f"{c['reviewNote']} {msg}" if c["reviewNote"] else msg
            stats["household"] += 1

stats["clients_flagged"] = sum(1 for c in clients if c["needsReview"])

json.dump(clients, open(OUT + "clients.json", "w"), indent=1, ensure_ascii=False)
json.dump(patients, open(OUT + "patients.json", "w"), indent=1, ensure_ascii=False)
json.dump(dropped, open(OUT + "dropped.json", "w"), indent=1)
print("=== curation stats ===")
for k, v in sorted(stats.items()): print(f"  {k:<26} {v}")
