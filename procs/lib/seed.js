/*
 * Starter library – standard checklists and procedures. Every item is marked for review: edit it to the firm's
 * practice before sending, and keep year-specific items (payment for an AY, due dates) dated so that they can be archived.
 */
window.PROC_SEED = (function () {
  const today = new Date().toISOString().slice(0, 10);
  const item = (cat, title, html, extra) => Object.assign({ id: 'seed-' + Math.random().toString(36).slice(2, 10), cat, title, kind: 'doc', html, url: '', note: 'Starter text – review and edit before use.',
    validFor: '', reviewBy: '', archived: false, archivedOn: '', created: today, updated: today }, extra || {});
  return {
    kind: 'procedures-library', version: 1,
    cats: ['Income-tax', 'GST', 'ROC', 'General'],
    items: [
      item('ROC', 'Incorporation of a private limited company – information and documents required', `
<p>Please send the following information and documents for the incorporation of the company:</p>
<h4>A. About the company</h4>
<ol>
<li>Proposed name of the company – two names in the order of preference, with the meaning / significance of the words used</li>
<li>Main objects – nature of the activity to be carried on by the company</li>
<li>Authorised share capital and paid-up (subscribed) share capital</li>
<li>Number of directors and number of shareholders (subscribers)</li>
<li>Shareholding % of each director / shareholder</li>
<li>Address of the registered office, with the email ID and phone number of the company</li>
<li>Bank in which the current account of the company is to be opened</li>
</ol>
<h4>B. Details of each director / shareholder</h4>
<ol>
<li>DIN, if already allotted</li>
<li>Whether a director / partner in any other company / LLP – if so, the name of the company / LLP, its CIN / LLPIN and the DIN</li>
<li>Full name as in PAN, father's name, date and place of birth, nationality</li>
<li>Educational qualification and occupation</li>
<li>Present residential address and the duration of stay there (if less than one year, the previous address also)</li>
<li>Email ID and mobile number (personal – OTPs are sent to these)</li>
</ol>
<h4>C. Documents – each director / shareholder</h4>
<ol>
<li>PAN card</li>
<li>Aadhaar card</li>
<li>Latest bank statement / electricity bill / telephone or mobile bill (not older than two months) – proof of present address</li>
<li>Passport-size photograph</li>
<li>Passport – for foreign nationals and NRIs (with notarisation / apostille as required)</li>
<li>Class 3 Digital Signature Certificate, if available (else the documents for obtaining one)</li>
</ol>
<h4>D. Registered office</h4>
<ol>
<li>Electricity bill (EB card copy) / property tax receipt of the premises – not older than two months</li>
<li>Rent / lease agreement, if the premises are rented</li>
<li>No-objection certificate from the owner of the premises</li>
</ol>
<p>Scanned copies (PDF / JPG) of the documents may be sent by email. The originals may be required for verification.</p>`),
      item('ROC', 'Incorporation of an LLP – information and documents required', `
<p>Please send the following information and documents for the incorporation of the LLP:</p>
<h4>A. About the LLP</h4>
<ol>
<li>Proposed name of the LLP – two names in the order of preference</li>
<li>Business activity of the LLP</li>
<li>Number of partners and designated partners (at least two designated partners; at least one of them resident in India)</li>
<li>Contribution of each partner and the profit sharing ratio</li>
<li>Address of the registered office, with the email ID and phone number of the LLP</li>
</ol>
<h4>B. Details of each partner</h4>
<ol>
<li>DIN / DPIN, if already allotted</li>
<li>Whether a director / partner in any other company / LLP – if so, the name, CIN / LLPIN and DIN</li>
<li>Full name as in PAN, father's name, date and place of birth, nationality</li>
<li>Educational qualification and occupation</li>
<li>Present residential address and the duration of stay there</li>
<li>Email ID and mobile number</li>
</ol>
<h4>C. Documents – each partner</h4>
<ol>
<li>PAN card and Aadhaar card</li>
<li>Latest bank statement / electricity bill / telephone or mobile bill (not older than two months) – proof of present address</li>
<li>Passport-size photograph</li>
<li>Passport – for foreign nationals and NRIs</li>
<li>Class 3 Digital Signature Certificate, if available</li>
</ol>
<h4>D. Registered office</h4>
<ol>
<li>Electricity bill (EB card copy) / property tax receipt – not older than two months</li>
<li>Rent / lease agreement, if rented, and the no-objection certificate from the owner</li>
</ol>
<p>The LLP agreement is to be filed with the Registrar within 30 days of incorporation (Form 3).</p>`),
      item('Income-tax', 'Payment of income tax (advance tax / self-assessment tax) – procedure', `
<p>The tax can be paid online through the Income-tax e-filing portal:</p>
<ol>
<li>Go to <a href="https://www.incometax.gov.in">www.incometax.gov.in</a> and click <b>e-Pay Tax</b> (no login needed: enter the PAN, confirm it and enter the OTP sent to your mobile).</li>
<li>Choose <b>Income Tax</b> and click <b>Proceed</b>.</li>
<li>Select the <b>Assessment Year</b> and the <b>Type of Payment</b>:
<ul><li>Advance Tax – minor head 100</li><li>Self-Assessment Tax – minor head 300</li><li>Tax on Regular Assessment (demand) – minor head 400</li></ul></li>
<li>Enter the amount of tax (and interest, if any) and click <b>Continue</b>.</li>
<li>Choose the mode of payment – net banking, debit card, UPI, RTGS / NEFT or payment at a bank counter – and pay.</li>
<li>Download the challan receipt and send us a copy (it shows the BSR code, challan number (CIN) and date, which are needed for the return).</li>
</ol>
<p>Amount to be paid: Rs. ________ &nbsp; Assessment Year: ________ &nbsp; Type of payment: ________</p>`, { validFor: 'Confirm the AY before sending' }),
      item('Income-tax', 'Payment of TDS – procedure (Challan 281)', `
<ol>
<li>Go to <a href="https://www.incometax.gov.in">www.incometax.gov.in</a> and click <b>e-Pay Tax</b> (enter the TAN and the OTP), or log in with the TAN.</li>
<li>Choose <b>TDS / TCS</b> and click <b>Proceed</b>.</li>
<li>Select the year, <b>Type of Payment</b> – TDS / TCS payable by taxpayer (200) or TDS / TCS regular assessment (400) – and the <b>nature of payment</b> (the section / code for the payment on which tax was deducted, as shown on the portal).</li>
<li>Enter the amount of tax, and interest if paid late, and complete the payment.</li>
<li>Download the challan receipt and send us a copy.</li>
</ol>
<p>Due date: the 7th of the following month (for tax deducted in March: 30 April). Pay a separate challan for each nature of payment.</p>`),
      item('Income-tax', 'Filing the income-tax return – documents required (individuals)', `
<ol>
<li>PAN, Aadhaar and the login details of the income-tax portal (or the mobile number linked to Aadhaar for OTP)</li>
<li>Form 16 from the employer (salaried persons)</li>
<li>Bank statements / interest certificates of all savings and deposit accounts for the year</li>
<li>Capital gains statements – shares and mutual funds (broker / CAMS / KFintech), property sale and purchase deeds</li>
<li>Rent received – tenant's details, rent and municipal tax paid</li>
<li>Home loan interest certificate (if claiming interest on a housing loan)</li>
<li>Investments and payments for deductions (old regime) – LIC, PPF, ELSS, tuition fees, medical insurance, donations, etc.</li>
<li>Details of foreign assets and income, if any</li>
<li>Bank account (number and IFSC) for the refund</li>
<li>Copies of tax challans for advance tax / self-assessment tax paid</li>
</ol>
<p>We will download Form 26AS, AIS and TIS from the portal and reconcile them with the above.</p>`),
      item('GST', 'GST registration – documents required', `
<ol>
<li>PAN of the business (for a firm / company / LLP) and PAN and Aadhaar of the proprietor / each partner / director</li>
<li>Passport-size photograph of the proprietor / partners / directors and the authorised signatory</li>
<li>Proof of constitution – partnership deed / certificate of incorporation / LLP agreement, as applicable</li>
<li>Proof of the principal place of business – electricity bill / property tax receipt, and the rent agreement with the owner's consent / NOC if rented</li>
<li>Bank account proof – cancelled cheque or the first page of the pass book / latest statement</li>
<li>Letter of authorisation / board resolution for the authorised signatory</li>
<li>Email ID and mobile number of the business and the authorised signatory</li>
<li>Nature of business and the main goods / services (HSN / SAC)</li>
</ol>
<p>Aadhaar authentication of the applicant is done through OTP during the application.</p>`),
      item('GST', 'Payment of GST – procedure (PMT-06 challan)', `
<ol>
<li>Log in to <a href="https://www.gst.gov.in">www.gst.gov.in</a> and go to <b>Services → Payments → Create Challan</b>.</li>
<li>Enter the amounts under IGST / CGST / SGST / Cess against tax, interest, late fee, penalty or others, as advised.</li>
<li>Select the mode of payment (e-payment, over the counter or NEFT / RTGS) and click <b>Generate Challan</b>.</li>
<li>Pay the challan and download the receipt (it shows the CPIN and CIN). Please send us a copy.</li>
</ol>
<p>The challan (CPIN) is valid for a limited period after it is generated – pay it promptly, or generate a new one.</p>`),
      item('General', 'Digital Signature Certificate (Class 3) – documents required', `
<ol>
<li>PAN card</li>
<li>Aadhaar card (the mobile number linked to Aadhaar is used for verification)</li>
<li>Passport-size photograph</li>
<li>Email ID and mobile number of the applicant</li>
<li>For an organisation DSC – proof of the organisation and the authorisation letter</li>
</ol>
<p>The applicant will have to complete a short video verification and the email / mobile OTP verification.</p>`),
    ]
  };
})();
