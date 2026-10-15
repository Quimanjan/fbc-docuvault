/* Draws watermarked SAMPLE papers on a canvas so demo records need no uploaded files. */
(function () {
  const W = 850, H = 1100, INK = "#1e2230", GREY = "#787c87";
  const SERIF = 'Georgia, "Times New Roman", serif', SANS = 'Arial, Helvetica, sans-serif', MONO = '"Courier New", monospace';
  const cache = {};

  function setup(bg) {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = bg || "#fcfaf4"; g.fillRect(0, 0, W, H);
    g.textBaseline = "top";
    return [c, g];
  }
  const f = (size, fam, w) => `${w || ""} ${size}px ${fam}`.trim();
  function center(g, y, t, font, color) { g.font = font; g.fillStyle = color || INK; g.fillText(t, (W - g.measureText(t).width) / 2, y); }
  function text(g, x, y, t, font, color) { g.font = font; g.fillStyle = color || INK; g.fillText(t, x, y); }
  function line(g, x1, y1, x2, y2, color, w) { g.strokeStyle = color || INK; g.lineWidth = w || 1; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  function field(g, x, y, label, value, w) {
    text(g, x, y, label, f(12, SANS), GREY);
    text(g, x, y + 16, value, f(17, SERIF));
    line(g, x, y + 40, x + w, y + 40, "#aaa");
  }
  function watermark(g) {
    g.save(); g.translate(W / 2, H / 2); g.rotate(-35 * Math.PI / 180);
    g.font = f(96, SANS, "bold"); g.fillStyle = "rgba(200,40,40,0.22)";
    const t = "SAMPLE ONLY"; g.fillText(t, -g.measureText(t).width / 2, -48); g.restore();
    text(g, 24, H - 30, "Mock document for app demonstration. Not a valid record.", f(13, SANS), "#b43c3c");
  }
  function sig(g, x, y, w, label) { line(g, x, y, x + w, y); text(g, x, y + 6, label, f(13, SANS), GREY); }
  function deped(g, title, sub) {
    center(g, 40, "Republic of the Philippines", f(15, SERIF));
    center(g, 60, "DEPARTMENT OF EDUCATION", f(18, SERIF, "bold"));
    center(g, 84, "Region VI / Negros Island Region", f(14, SERIF), GREY);
    g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(95, 75, 35, 0, Math.PI * 2); g.stroke();
    text(g, 77, 67, "SEAL", f(14, SANS, "bold"));
    center(g, 130, title, f(26, SERIF, "bold"));
    center(g, 166, sub, f(15, SERIF), GREY);
  }
  const SUBJ = ["Oral Communication", "General Mathematics", "Earth and Life Science", "Komunikasyon at Pananaliksik", "Physical Education and Health",
    "Empowerment Technologies", "Statistics and Probability", "Personal Development", "Understanding Culture, Society and Politics"];
  function rng(seed) { let s = 0; for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return () => ((s = (s * 1103515245 + 12345) >>> 0) % 1000) / 1000; }
  function grades(g, top, seed, cols) {
    const r = rng(seed), x0 = 60, x1 = 790, cx = [560, 640, 720];
    g.fillStyle = "#e4e8ee"; g.fillRect(x0, top, x1 - x0, 34); g.strokeStyle = INK; g.strokeRect(x0, top, x1 - x0, 34);
    text(g, x0 + 10, top + 9, "Learning Area", f(14, SANS, "bold"));
    cols.forEach((c, i) => text(g, cx[i], top + 9, c, f(14, SANS, "bold")));
    let y = top + 34;
    for (const s of SUBJ) {
      g.strokeStyle = "#999"; g.strokeRect(x0, y, x1 - x0, 32);
      text(g, x0 + 10, y + 8, s, f(14, SERIF));
      const a = 84 + Math.floor(r() * 13), b = 84 + Math.floor(r() * 13);
      [a, b, Math.round((a + b) / 2)].forEach((v, i) => text(g, cx[i] + 4, y + 8, String(v), f(15, MONO)));
      y += 32;
    }
    return y;
  }
  function college(g, title) {
    g.fillStyle = "#7a1c2a"; g.fillRect(0, 0, W, 120);
    g.strokeStyle = "#e0b552"; g.lineWidth = 3; g.beginPath(); g.arc(78, 60, 38, 0, Math.PI * 2); g.stroke();
    text(g, 60, 51, "FBC", f(18, SANS, "bold"), "#e0b552");
    text(g, 140, 32, "FELLOWSHIP BAPTIST COLLEGE", f(26, SERIF, "bold"), "#fff");
    text(g, 140, 70, "Kabankalan City, Negros Occidental", f(15, SERIF), "#f0d8dc");
    if (title) center(g, 170, title, f(28, SERIF, "bold"));
  }
  function body(g, y, lines) { for (const l of lines) { text(g, 90, y, l, f(17, SERIF)); y += 34; } }
  function cert(g, o) {
    g.strokeStyle = o.color; g.lineWidth = 6; g.strokeRect(24, 24, W - 48, H - 48);
    g.lineWidth = 1; g.strokeRect(36, 36, W - 72, H - 72);
    let y = 80;
    for (const [t, ft, c] of o.head) { center(g, y, t, ft, c); y += 24; }
    center(g, 200, o.title, f(30, SERIF, "bold"), o.color);
    center(g, 270, o.pre, f(16, SERIF));
    center(g, 305, o.name, f(30, SERIF, "bold"));
    y = 360; for (const l of o.lines) { center(g, y, l, l.bold ? f(18, SERIF, "bold") : f(16, SERIF)); y += 32; }
    if (o.serial) { center(g, 540, "NSTP SERIAL NUMBER", f(14, SANS, "bold"), GREY); center(g, 564, o.serial, f(28, MONO)); }
    sig(g, 90, 800, 290, o.sig1); sig(g, 470, 800, 290, o.sig2);
  }
  const L = (s, bold) => Object.assign(new String(s), { bold });

  const DRAW = {
    form137(g, p) {
      deped(g, "LEARNER'S PERMANENT RECORD", "(Formerly Form 137) - Senior High School");
      field(g, 60, 200, "LAST NAME", p.last, 220); field(g, 300, 200, "FIRST NAME", p.first, 220); field(g, 540, 200, "MIDDLE NAME", p.middle, 250);
      field(g, 60, 255, "LRN", p.lrn, 220); field(g, 300, 255, "DATE OF BIRTH", p.dob, 220); field(g, 540, 255, "SEX", p.sex, 250);
      field(g, 60, 310, "SCHOOL", p.shs, 460); field(g, 540, 310, "TRACK / STRAND", p.strand, 250);
      text(g, 60, 376, "SCHOLASTIC RECORD - GRADE 12, SY 2021-2022", f(15, SANS, "bold"));
      const y = grades(g, 400, p.last + "137", ["Sem 1", "Sem 2", "Final"]);
      text(g, 60, y + 30, "Eligible for admission to: COLLEGE", f(16, SERIF, "bold"));
      sig(g, 60, y + 150, 280, "School Registrar"); sig(g, 470, y + 150, 320, "School Principal");
    },
    form138(g, p) {
      deped(g, "REPORT CARD", "(Form 138) - Learner's Progress Report, SY 2021-2022");
      field(g, 60, 200, "NAME", `${p.last}, ${p.first} ${p.middle[0]}.`, 460); field(g, 540, 200, "LRN", p.lrn, 250);
      field(g, 60, 255, "GRADE & SECTION", "Grade 12 - " + p.section, 460); field(g, 540, 255, "TRACK / STRAND", p.strand, 250);
      const y = grades(g, 320, p.last + "138", ["Q3", "Q4", "Final"]);
      text(g, 60, y + 20, "General Average: 91", f(18, SERIF, "bold")); text(g, 60, y + 60, "Remarks: PROMOTED", f(16, SERIF));
      sig(g, 60, y + 120, 340, "Parent / Guardian"); sig(g, 470, y + 120, 320, "Class Adviser");
    },
    psa(g, p) {
      g.strokeStyle = "#3c6e50"; g.lineWidth = 3; g.strokeRect(30, 30, W - 60, H - 60);
      center(g, 50, "Republic of the Philippines", f(14, SERIF));
      center(g, 72, "PHILIPPINE STATISTICS AUTHORITY", f(20, SERIF, "bold"), "#285a3c");
      center(g, 110, "CERTIFICATE OF LIVE BIRTH", f(28, SERIF, "bold"));
      center(g, 150, "Municipal Form No. 102 (Revised)", f(13, SERIF), GREY);
      field(g, 60, 190, "PROVINCE", "Negros Occidental", 330); field(g, 420, 190, "CITY / MUNICIPALITY", p.birthplace, 370);
      text(g, 60, 250, "1. NAME", f(14, SANS, "bold"));
      field(g, 60, 272, "(First)", p.first, 220); field(g, 300, 272, "(Middle)", p.middle, 220); field(g, 540, 272, "(Last)", p.last, 250);
      field(g, 60, 330, "2. SEX", p.sex, 220); field(g, 300, 330, "3. DATE OF BIRTH", p.dob, 490);
      field(g, 60, 390, "4. PLACE OF BIRTH", p.birthplace + ", Negros Occidental", 730);
      field(g, 60, 460, "5. MOTHER'S MAIDEN NAME", p.mother, 460); field(g, 540, 460, "6. CITIZENSHIP", "Filipino", 250);
      field(g, 60, 530, "7. FATHER'S NAME", p.father, 460); field(g, 540, 530, "8. CITIZENSHIP", "Filipino", 250);
      field(g, 60, 610, "REGISTRY NO.", p.reg, 330);
      text(g, 60, 720, "This is to certify that the above is a true copy of the record on file.", f(14, SERIF));
      g.strokeStyle = "#3c6e50"; g.beginPath(); g.arc(690, 890, 70, 0, Math.PI * 2); g.stroke();
      text(g, 650, 882, "DRY SEAL", f(14, SANS, "bold"), "#3c6e50");
      sig(g, 60, 900, 340, "Civil Registrar General");
    },
    nstp(g, p) {
      cert(g, { color: "#967828", head: [["Republic of the Philippines", f(15, SERIF)], ["COMMISSION ON HIGHER EDUCATION", f(18, SERIF, "bold")], ["National Service Training Program", f(15, SERIF), GREY]],
        title: "CERTIFICATE OF COMPLETION", pre: "This certifies that", name: `${p.first.toUpperCase()} ${p.middle[0]}. ${p.last.toUpperCase()}`,
        lines: ["has satisfactorily completed the", L("Civic Welfare Training Service (CWTS) 1 and 2", true), "at Fellowship Baptist College, Kabankalan City", "in accordance with Republic Act No. 9163."],
        serial: p.nstp, sig1: "NSTP Coordinator", sig2: "College President" });
    },
    goodmoral(g, p) {
      college(g, "CERTIFICATE OF GOOD MORAL CHARACTER");
      body(g, 260, ["TO WHOM IT MAY CONCERN:", "", `This is to certify that ${p.first} ${p.middle[0]}. ${p.last}, a bona fide`, `student of this institution taking up ${p.course},`,
        "has not been subjected to any disciplinary action during", "the student's stay in Fellowship Baptist College.", "", "Issued upon request for graduation requirements purposes."]);
      sig(g, 480, 760, 290, "Guidance Counselor");
    },
    brgy(g, p) {
      center(g, 50, "Republic of the Philippines", f(14, SERIF)); center(g, 70, "City of Kabankalan", f(14, SERIF));
      center(g, 94, `BARANGAY ${p.brgy.toUpperCase()}`, f(20, SERIF, "bold")); line(g, 60, 130, 790, 130, INK, 2);
      center(g, 200, "BARANGAY CLEARANCE", f(30, SERIF, "bold"));
      body(g, 290, ["TO WHOM IT MAY CONCERN:", "", `This is to certify that ${p.first.toUpperCase()} ${p.middle[0]}. ${p.last.toUpperCase()},`, `is a bona fide resident of Barangay ${p.brgy},`,
        "Kabankalan City, and has no derogatory record on file.", "", "Purpose: SCHOOL REQUIREMENT"]);
      sig(g, 480, 760, 290, "Punong Barangay");
    },
    deanslist(g, p) {
      cert(g, { color: "#7a1c2a", head: [["FELLOWSHIP BAPTIST COLLEGE", f(20, SERIF, "bold")], ["Kabankalan City", f(15, SERIF), GREY]],
        title: "CERTIFICATE OF RECOGNITION", pre: "is awarded to", name: `${p.first.toUpperCase()} ${p.middle[0]}. ${p.last.toUpperCase()}`,
        lines: ["for being included in the", L("DEAN'S LIST", true), "First Semester, School Year 2025-2026"], sig1: "Dean", sig2: "College President" });
    },
    seminar(g, p) {
      cert(g, { color: "#28466e", head: [["NEGROS ICT STUDENTS' SUMMIT 2026", f(20, SANS, "bold")], ["Bacolod City", f(15, SERIF), GREY]],
        title: "CERTIFICATE OF PARTICIPATION", pre: "This is presented to", name: `${p.first.toUpperCase()} ${p.middle[0]}. ${p.last.toUpperCase()}`,
        lines: ["for participating in the seminar", L("“Cybersecurity Awareness for Students”", true), "held on August 22, 2026"], sig1: "Program Chair", sig2: "Organizer" });
    },
    camp(g, p) {
      cert(g, { color: "#3c6e46", head: [["KABANKALAN FELLOWSHIP BAPTIST CHURCH", f(19, SERIF, "bold")], ["Youth Ministry", f(15, SERIF), GREY]],
        title: "CERTIFICATE OF COMPLETION", pre: "awarded to", name: `${p.first.toUpperCase()} ${p.middle[0]}. ${p.last.toUpperCase()}`,
        lines: ["for completing the Summer Youth Camp 2026", "May 18-22, 2026"], sig1: "Youth Pastor", sig2: "Camp Director" });
    },
    receipt(g, p) {
      college(g, "OFFICIAL RECEIPT");
      center(g, 210, "No. 0187432", f(18, MONO), "#962830");
      const rows = [["Date", "Oct 1, 2026"], ["Received from", `${p.first} ${p.middle[0]}. ${p.last}`], ["Course/Yr", p.course]];
      let y = 270; for (const [k, v] of rows) { text(g, 120, y, k, f(15, SANS), GREY); text(g, 330, y, v, f(17, SERIF)); y += 38; }
      line(g, 120, y + 10, 730, y + 10); y += 30;
      for (const [k, v] of [["Tuition - Midterm", "4,500.00"], ["Laboratory fee", "800.00"], ["Library fee", "250.00"]]) {
        text(g, 120, y, k, f(17, SERIF)); g.font = f(17, MONO); text(g, 730 - g.measureText(v).width, y, v, f(17, MONO)); y += 36;
      }
      line(g, 120, y + 6, 730, y + 6); y += 22;
      text(g, 120, y, "TOTAL (PHP)", f(17, SANS, "bold")); g.font = f(19, MONO); text(g, 730 - g.measureText("5,550.00").width, y, "5,550.00", f(19, MONO));
      sig(g, 440, 800, 290, "Cashier");
    },
  };
  const BG = { form138: "#fafbfd", psa: "#f6f9f4", nstp: "#fdfbf5", receipt: "#fffffc" };

  window.mockPaper = function (kind, person, blur) {
    const key = kind + "|" + (blur ? "b|" : "") + JSON.stringify(person);
    if (cache[key]) return cache[key];
    let [c, g] = setup(BG[kind]);
    (DRAW[kind] || DRAW.goodmoral)(g, person);
    watermark(g);
    if (blur) { const [c2, g2] = setup(); g2.filter = "blur(3px)"; g2.drawImage(c, 0, 0); c = c2; }
    return (cache[key] = c.toDataURL("image/jpeg", 0.82));
  };

  window.SAMPLE_PEOPLE = {
    juan: { first: "Juan", middle: "Mendoza", last: "Dela Cruz", sex: "Male", dob: "June 12, 2006", lrn: "117652110599", shs: "Kabankalan City National High School",
      strand: "TVL-ICT", section: "Turing", birthplace: "Kabankalan City", mother: "Ana Reyes Mendoza", father: "Pedro Santos Dela Cruz", reg: "2006-1203",
      nstp: "C-0626-NIR-004517", course: "BSIT 2", brgy: "Binicuil" },
    maria: { first: "Maria Lourdes", middle: "Santos", last: "Villanueva", sex: "Female", dob: "March 14, 2004", lrn: "117652110034", shs: "Kabankalan City National High School",
      strand: "STEM", section: "Einstein", birthplace: "Kabankalan City", mother: "Elena Ramos Santos", father: "Roberto Cruz Villanueva", reg: "2004-0812",
      nstp: "C-0624-NIR-001842", course: "BS Information Technology", brgy: "Tagukon" },
    mark: { first: "Mark Anthony", middle: "Lopez", last: "Delos Reyes", sex: "Male", dob: "July 2, 2003", lrn: "117652110211", shs: "Fellowship Baptist College SHS",
      strand: "HUMSS", section: "Rizal", birthplace: "Himamaylan City", mother: "Gloria Tan Lopez", father: "Antonio Gil Delos Reyes", reg: "2003-1544",
      nstp: "C-0624-NIR-001907", course: "Bachelor of Elementary Education", brgy: "Hilamonan" },
    kristine: { first: "Kristine Joy", middle: "Mabini", last: "Abellar", sex: "Female", dob: "November 28, 2003", lrn: "117652110387", shs: "Ilog National High School",
      strand: "ABM", section: "Mabini", birthplace: "Kabankalan City", mother: "Rosario Diaz Mabini", father: "Jose Ramon Abellar", reg: "2003-2601",
      nstp: "", course: "BS Business Administration", brgy: "Camansi" },
    rhea: { first: "Rhea Mae", middle: "Gonzaga", last: "Tolentino", sex: "Female", dob: "February 9, 2005", lrn: "117652110455", shs: "Kabankalan City National High School",
      strand: "TVL-ICT", section: "Turing", birthplace: "Kabankalan City", mother: "Liza Perez Gonzaga", father: "Ramil Uy Tolentino", reg: "2005-0377",
      nstp: "", course: "BS Information Technology", brgy: "Salong" },
  };
})();
