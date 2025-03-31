// defaultCommittees5.js

// List of female names used for title adjustments in the committee legend.
export const FEMALE_NAMES = [
    "Diane Larson",
    "Kathy Hogan",
    "Judy Lee",
    "Desiree Van Oosting",
    "Michelle Powers",
    "Michelle Axtman",
    "Claire Cory",
    "Kristin Roers",
    "Janne Myrdal",
    "Karla Rose Hanson",
    "Lisa Meier",
    "Brandy L. Pyle",
    "Alisa Mitskog",
    "Emily O'Brien",
    "Liz Conmy",
    "LaurieBeth Hager",
    "Desiree Morton",
    "Anna S. Novak",
    "Cynthia Schreiber-Beck",
    "Vicky Steiner",
    "Gretchen Dobervich",
    "Collette Brown",
    "Lisa Finley-DeVille",
    "Karen Grindberg",
    "Karen M. Rohr",
    "Mary Schneider",
    "Christina Wolff",
    "Donna Henderson",
    "SuAnn Olson",
    "Karen Karls",
    "Carrie McLeod",
    "Jayme Davis",
    "Kathy Frelich",
    "Macy Bolinske",
    "Karen A. Anderson",
    "Dori Hauck"
  ];
  
  // Object mapping committee names to arrays of member objects.
  // Each member object has a 'name' property and a 'memberNo' property.
  // 'memberNo' is initially set to null and will be populated from allMember.xml.
  export const DEFAULT_COMMITTEES = {
    // ---------- SENATE -----------
    "Senate Appropriations Committee": [
      { name: "Brad Bekkedahl - Chairman", memberNo: null },
      { name: "Robert Erbele - Vice Chairman", memberNo: null }
    ],
    "Senate Education and Environment Committee": [
      { name: "Ronald Sorvaag - Chairman", memberNo: null },
      { name: "Cole Conley", memberNo: null },
      { name: "Scott Meyer", memberNo: null },
      { name: "Donald Schaible", memberNo: null },
      { name: "Paul J. Thomas", memberNo: null }
    ],
    "Senate Government Operations Committee": [
      { name: "Terry M. Wanzek - Chairman", memberNo: null },
      { name: "Randy A. Burckhard", memberNo: null },
      { name: "Michael Dwyer", memberNo: null },
      { name: "Robert Erbele", memberNo: null },
      { name: "Jonathan Sickler", memberNo: null }
    ],
    "Senate Human Resources Committee": [
      { name: "Dick Dever - Chairman", memberNo: null },
      { name: "Tim Mathern", memberNo: null },
      { name: "Sean Cleary", memberNo: null },
      { name: "Kyle Davison", memberNo: null },
      { name: "Jeffery J. Magrum", memberNo: null }
    ],
    "Senate Education Committee": [
      { name: "Todd Beard - Chairman", memberNo: null },
      { name: "Josh Boschee", memberNo: null },
      { name: "Randy D. Lemm - Vice Chairman", memberNo: null },
      { name: "Michelle Axtman", memberNo: null },
      { name: "Justin Gerhardt", memberNo: null },
      { name: "Mike Wobbema", memberNo: null }
    ],
    "Senate Finance and Taxation Committee": [
      { name: "Mark F. Weber - Chairman", memberNo: null },
      { name: "Richard Marcellais", memberNo: null },
      { name: "Dean Rummel - Vice Chairman", memberNo: null },
      { name: "Dale Patten", memberNo: null },
      { name: "Michelle Powers", memberNo: null },
      { name: "Chuck Walen", memberNo: null }
    ],
    "Senate Human Services Committee": [
      { name: "Judy Lee - Chairman", memberNo: null },
      { name: "Kathy Hogan", memberNo: null },
      { name: "Kent Weston - Vice Chairman", memberNo: null },
      { name: "David A. Clemens", memberNo: null },
      { name: "Kristin Roers", memberNo: null },
      { name: "Desiree Van Oosting", memberNo: null }
    ],
    "Senate Industry and Business Committee": [
      { name: "Jeff Barta - Chairman", memberNo: null },
      { name: "Keith Boehm - Vice Chairman", memberNo: null },
      { name: "Mark Enget", memberNo: null },
      { name: "Greg Kessel", memberNo: null },
      { name: "Jerry Klein", memberNo: null }
    ],
    "Senate Judiciary Committee": [
      { name: "Diane Larson - Chairman", memberNo: null },
      { name: "Ryan Braunberger", memberNo: null },
      { name: "Bob Paulson - Vice Chairman", memberNo: null },
      { name: "Jose L. Castaneda", memberNo: null },
      { name: "Claire Cory", memberNo: null },
      { name: "Larry Luick", memberNo: null },
      { name: "Janne Myrdal", memberNo: null }
    ],
    "Senate Agriculture and Veterans Affairs Committee": [
      { name: "Larry Luick - Chairman", memberNo: null },
      { name: "Richard Marcellais", memberNo: null },
      { name: "Janne Myrdal - Vice Chairman", memberNo: null },
      { name: "Randy D. Lemm", memberNo: null },
      { name: "Mark F. Weber", memberNo: null },
      { name: "Kent Weston", memberNo: null }
    ],
    "Senate Energy and Natural Resources Committee": [
      { name: "Dale Patten - Chairman", memberNo: null },
      { name: "Greg Kessel - Vice Chairman", memberNo: null },
      { name: "Todd Beard", memberNo: null },
      { name: "Keith Boehm", memberNo: null },
      { name: "Mark Enget", memberNo: null },
      { name: "Justin Gerhardt", memberNo: null },
      { name: "Desiree Van Oosting", memberNo: null }
    ],
    "Senate State and Local Government Committee": [
      { name: "Kristin Roers - Chairman", memberNo: null },
      { name: "Ryan Braunberger", memberNo: null },
      { name: "Jose L. Castaneda - Vice Chairman", memberNo: null },
      { name: "Jeff Barta", memberNo: null },
      { name: "Judy Lee", memberNo: null },
      { name: "Chuck Walen", memberNo: null }
    ],
    "Senate Transportation Committee": [
      { name: "David A. Clemens - Chairman", memberNo: null },
      { name: "Kathy Hogan", memberNo: null },
      { name: "Claire Cory - Vice Chairman", memberNo: null },
      { name: "Jerry Klein", memberNo: null },
      { name: "Bob Paulson", memberNo: null },
      { name: "Dean Rummel", memberNo: null }
    ],
    "Senate Workforce Development Committee": [
      { name: "Mike Wobbema - Chairman", memberNo: null },
      { name: "Josh Boschee", memberNo: null },
      { name: "Michelle Axtman - Vice Chairman", memberNo: null },
      { name: "Diane Larson", memberNo: null },
      { name: "Michelle Powers", memberNo: null }
    ],
  
    // ---------- HOUSE -----------
    "House Appropriations Committee": [
      { name: "Don Vigesaa - Chairman", memberNo: null },
      { name: "Keith Kempenich - Vice Chairman", memberNo: null }
    ],
    "House Appropriations Education & Environment Division": [
      { name: "Mike Nathe - Chairman", memberNo: null },
      { name: "Karla Rose Hanson", memberNo: null },
      { name: "Steve Swiontek - Vice Chairman", memberNo: null },
      { name: "Scott Louser", memberNo: null },
      { name: "Bob Martinson", memberNo: null },
      { name: "David Richter", memberNo: null },
      { name: "Mark Sanford", memberNo: null }
    ],
    "House Appropriations Government Operations Division": [
      { name: "David Monson - Chairman", memberNo: null },
      { name: "Mike Brandenburg - Vice Chairman", memberNo: null },
      { name: "Glenn Bosch", memberNo: null },
      { name: "Jay Fisher", memberNo: null },
      { name: "Keith Kempenich", memberNo: null },
      { name: "Lisa Meier", memberNo: null },
      { name: "Brandy L. Pyle", memberNo: null }
    ],
    "House Appropriations Human Resources Division": [
      { name: "Jon O. Nelson - Chairman", memberNo: null },
      { name: "Alisa Mitskog", memberNo: null },
      { name: "Gregory Stemen - Vice Chairman", memberNo: null },
      { name: "Bert Anderson", memberNo: null },
      { name: "Mike Berg", memberNo: null },
      { name: "Eric J. Murphy", memberNo: null },
      { name: "Emily O'Brien", memberNo: null },
      { name: "Scott Wagner", memberNo: null }
    ],
    "House Education Committee": [
      { name: "Pat D. Heinert - Chairman", memberNo: null },
      { name: "Liz Conmy", memberNo: null },
      { name: "Cynthia Schreiber-Beck - Vice Chairman", memberNo: null },
      { name: "LaurieBeth Hager", memberNo: null },
      { name: "Patrick R. Hatlestad", memberNo: null },
      { name: "Dori Hauck", memberNo: null },
      { name: "Matthew Heilman", memberNo: null },
      { name: "Jim Jonas", memberNo: null },
      { name: "Donald W. Longmuir", memberNo: null },
      { name: "Roger A. Maki", memberNo: null },
      { name: "Andrew Marschall", memberNo: null },
      { name: "Desiree Morton", memberNo: null },
      { name: "Anna S. Novak", memberNo: null },
      { name: "Doug Osowski", memberNo: null }
    ],
    "House Finance and Taxation Committee": [
      { name: "Craig Headland - Chairman", memberNo: null },
      { name: "Austin Foss", memberNo: null },
      { name: "Jared C. Hagert - Vice Chairman", memberNo: null },
      { name: "Zachary Ista", memberNo: null },
      { name: "Dick Anderson", memberNo: null },
      { name: "Jason Dockter", memberNo: null },
      { name: "Ty Dressler", memberNo: null },
      { name: "Jim Grueneich", memberNo: null },
      { name: "Mike Motschenbacher", memberNo: null },
      { name: "Dennis Nehring", memberNo: null },
      { name: "Jeremy L. Olson", memberNo: null },
      { name: "Todd Porter", memberNo: null },
      { name: "Vicky Steiner", memberNo: null },
      { name: "Nathan Toman", memberNo: null }
    ],
    "House Human Services Committee": [
      { name: "Matthew Ruby - Chairman", memberNo: null },
      { name: "Jayme Davis", memberNo: null },
      { name: "Kathy Frelich - Vice Chairman", memberNo: null },
      { name: "Gretchen Dobervich", memberNo: null },
      { name: "Karen A. Anderson", memberNo: null },
      { name: "Mike Beltz", memberNo: null },
      { name: "Macy Bolinske", memberNo: null },
      { name: "Clayton Fegley", memberNo: null },
      { name: "Jared Hendrix", memberNo: null },
      { name: "Dawson Holle", memberNo: null },
      { name: "Dwight Kiefert", memberNo: null },
      { name: "Nico Rios", memberNo: null },
      { name: "Karen M. Rohr", memberNo: null }
    ],
    "House Industry, Business and Labor Committee": [
      { name: "Jonathan Warrey - Chairman", memberNo: null },
      { name: "Collette Brown", memberNo: null },
      { name: "Mitch Ostlie - Vice Chairman", memberNo: null },
      { name: "Lisa Finley-DeVille", memberNo: null },
      { name: "Landon Bahl", memberNo: null },
      { name: "Josh Christy", memberNo: null },
      { name: "Karen Grindberg", memberNo: null },
      { name: "Jorin Johnson", memberNo: null },
      { name: "Jim Kasper", memberNo: null },
      { name: "Ben Koppelman", memberNo: null },
      { name: "Dan Ruby", memberNo: null },
      { name: "Mike Schatz", memberNo: null },
      { name: "Austen Schauer", memberNo: null },
      { name: "Daniel R. Vollmer", memberNo: null }
    ],
    "House Judiciary Committee": [
      { name: "Lawrence R. Klemin - Chairman", memberNo: null },
      { name: "Mary Schneider", memberNo: null },
      { name: "Karen Karls - Vice Chairman", memberNo: null },
      { name: "Steve Vetter - Vice Chairman", memberNo: null },
      { name: "Nels Christianson", memberNo: null },
      { name: "Donna Henderson", memberNo: null },
      { name: "Jeff Hoverson", memberNo: null },
      { name: "Daniel Johnston", memberNo: null },
      { name: "Carrie McLeod", memberNo: null },
      { name: "SuAnn Olson", memberNo: null },
      { name: "Bernie Satrom", memberNo: null },
      { name: "Bill Tveit", memberNo: null },
      { name: "Lori VanWinkle", memberNo: null },
      { name: "Christina Wolff", memberNo: null }
    ],
    "House Agriculture Committee": [
      { name: "Mike Beltz - Chairman", memberNo: null },
      { name: "Gretchen Dobervich", memberNo: null },
      { name: "Dori Hauck - Vice Chairman", memberNo: null },
      { name: "Karen A. Anderson", memberNo: null },
      { name: "Donna Henderson", memberNo: null },
      { name: "Dawson Holle", memberNo: null },
      { name: "Jeff Hoverson", memberNo: null },
      { name: "Dwight Kiefert", memberNo: null },
      { name: "Dennis Nehring", memberNo: null },
      { name: "SuAnn Olson", memberNo: null },
      { name: "Nico Rios", memberNo: null },
      { name: "Cynthia Schreiber-Beck", memberNo: null },
      { name: "Bill Tveit", memberNo: null },
      { name: "Daniel R. Vollmer", memberNo: null }
    ],
    "House Energy and Natural Resources Committee": [
      { name: "Todd Porter - Chairman", memberNo: null },
      { name: "Liz Conmy", memberNo: null },
      { name: "Dick Anderson - Vice Chairman", memberNo: null },
      { name: "Austin Foss", memberNo: null },
      { name: "Anna S. Novak - Vice Chairman", memberNo: null },
      { name: "Jason Dockter", memberNo: null },
      { name: "Jared C. Hagert", memberNo: null },
      { name: "Craig Headland", memberNo: null },
      { name: "Pat D. Heinert", memberNo: null },
      { name: "Jorin Johnson", memberNo: null },
      { name: "Andrew Marschall", memberNo: null },
      { name: "Jeremy L. Olson", memberNo: null },
      { name: "Matthew Ruby", memberNo: null }
    ],
    "House Government and Veterans Affairs Committee": [
      { name: "Austen Schauer - Chairman", memberNo: null },
      { name: "Collette Brown", memberNo: null },
      { name: "Bernie Satrom - Vice Chairman", memberNo: null },
      { name: "Mary Schneider", memberNo: null },
      { name: "Landon Bahl", memberNo: null },
      { name: "Josh Christy", memberNo: null },
      { name: "Karen Grindberg", memberNo: null },
      { name: "Karen Karls", memberNo: null },
      { name: "Carrie McLeod", memberNo: null },
      { name: "Karen M. Rohr", memberNo: null },
      { name: "Vicky Steiner", memberNo: null },
      { name: "Lori VanWinkle", memberNo: null },
      { name: "Steve Vetter", memberNo: null },
      { name: "Christina Wolff", memberNo: null }
    ],
    "House Political Subdivisions Committee": [
      { name: "Donald W. Longmuir - Chairman", memberNo: null },
      { name: "Jayme Davis", memberNo: null },
      { name: "Clayton Fegley - Vice Chairman", memberNo: null },
      { name: "LaurieBeth Hager", memberNo: null },
      { name: "Jim Jonas - Vice Chairman", memberNo: null },
      { name: "Macy Bolinske", memberNo: null },
      { name: "Patrick R. Hatlestad", memberNo: null },
      { name: "Matthew Heilman", memberNo: null },
      { name: "Lawrence R. Klemin", memberNo: null },
      { name: "Mike Motschenbacher", memberNo: null },
      { name: "Mitch Ostlie", memberNo: null },
      { name: "Nathan Toman", memberNo: null },
      { name: "Jonathan Warrey", memberNo: null }
    ],
    "House Transportation Committee": [
      { name: "Dan Ruby - Chairman", memberNo: null },
      { name: "Lisa Finley-DeVille", memberNo: null },
      { name: "Jim Grueneich - Vice Chairman", memberNo: null },
      { name: "Nels Christianson", memberNo: null },
      { name: "Ty Dressler", memberNo: null },
      { name: "Kathy Frelich", memberNo: null },
      { name: "Jared Hendrix", memberNo: null },
      { name: "Daniel Johnston", memberNo: null },
      { name: "Jim Kasper", memberNo: null },
      { name: "Ben Koppelman", memberNo: null },
      { name: "Roger A. Maki", memberNo: null },
      { name: "Desiree Morton", memberNo: null },
      { name: "Doug Osowski", memberNo: null },
      { name: "Mike Schatz", memberNo: null }
    ]
};