const fs=require("node:fs"), assert=require("node:assert/strict");
for(const page of ["privacy-policy","terms-of-service"]){
  const source=fs.readFileSync("app/"+page+"/page.tsx","utf8");
  assert.ok(source.includes("https://orbit-lm.com/"+page));
  assert.ok(source.includes("tsblsestudio@gmail.com"));
  assert.ok(!source.includes("cookies("));
  assert.ok(!source.includes("redirect("));
  for(const file of ["components/login-form.tsx","public/orbit-plans.html"]){
    assert.ok(fs.readFileSync(file,"utf8").includes('href="/'+page+'"'));
  }
  assert.ok(fs.readFileSync("public/orbit-plans.html","utf8").includes('href="/'+page+'" target="_top"'));
}
assert.ok(fs.readFileSync("components/legal-page.tsx","utf8").includes("max-w-4xl"));
assert.ok(fs.readFileSync("app/privacy-policy/page.tsx","utf8").includes("Google API Services User Data Policy"));
console.log("PASS: public legal routes, canonical URLs, contact details, both footer links and top-level iframe navigation");
