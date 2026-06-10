
var splitFile=null,splitActiveTrade=null,splitTrades=[];
function el(id){return document.getElementById(id);}
function esc(s){return s?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'):''; }
function escQ(s){return s?String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"):''; }
function fmtP(n){return n!=null?'\u00a3'+Number(n).toLocaleString('en-GB',{minimumFractionDigits:2}):'--'; }


function openAllocateModal(ref,desc){
  var ex=document.getElementById('allocate-modal');if(ex)ex.remove();
  var opts=splitTrades.filter(function(t){return t.id!=='unallocated';}).map(function(t){
    return '<option value="'+escQ(t.id)+'">'+esc(t.label)+'</option>';
  }).join('');
  var modal=document.createElement('div');
  modal.id='allocate-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:1000';
  modal.innerHTML='<div style="background:#fff;border-radius:10px;width:480px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,.2);overflow:hidden">'+
    '<div style="padding:16px 20px;background:var(--navy);display:flex;justify-content:space-between;align-items:center">'+
      '<div style="font-size:14px;font-weight:700;color:#fff">Manual Trade Allocation</div>'+
      '<button onclick="document.getElementById(\'allocate-modal\').remove()" style="background:transparent;border:none;color:rgba(255,255,255,.7);font-size:20px;cursor:pointer;line-height:1">&times;</button>'+
    '</div>'+
    '<div style="padding:20px">'+
      '<div style="background:var(--red-bg);border:1px solid rgba(196,43,28,.2);border-radius:6px;padding:11px 14px;margin-bottom:16px">'+
        '<div style="font-size:11px;font-weight:700;color:var(--red);text-transform:uppercase;margin-bottom:4px">Item '+esc(ref)+'</div>'+
        '<div style="font-size:13px;color:var(--text);line-height:1.5">'+esc(desc)+'</div>'+
      '</div>'+
      '<div style="margin-bottom:14px"><label style="display:block;font-size:12px;font-weight:600;color:var(--text-mid);margin-bottom:5px">Allocate to trade</label>'+
        '<select id="allocate-trade-select" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:4px;font-size:13px">'+opts+'</select></div>'+
      '<div style="margin-bottom:16px"><label style="display:block;font-size:12px;font-weight:600;color:var(--text-mid);margin-bottom:5px">Note (optional)</label>'+
        '<input type="text" id="allocate-note" placeholder="e.g. Mechanical \u2014 plumbing element only" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:4px;font-size:13px"></div>'+
      '<div style="display:flex;gap:10px;justify-content:flex-end">'+
        '<button onclick="document.getElementById(\'allocate-modal\').remove()" style="padding:8px 16px;background:var(--white);border:1px solid var(--border);border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;color:var(--text-mid);font-family:DM Sans,sans-serif">Cancel</button>'+
        '<button id="confirm-alloc-btn" style="padding:8px 18px;background:var(--navy);border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;color:#fff;font-family:DM Sans,sans-serif">Confirm Allocation</button>'+
      '</div>'+
    '</div>'+
  '</div>';
  document.body.appendChild(modal);
  document.getElementById('confirm-alloc-btn').onclick=function(){confirmAllocation(ref);};
}
// ══════════════════════════════════════════════════════════
// SCHEDULE SPLITTER MODULE
// ══════════════════════════════════════════════════════════

var splitFile = null;
var splitActiveTrade = null;
var splitTrades = [];   // [{id, label, nbs, items:[{ref,desc,qty,unit}], lineCount}]

// Realistic extracted data based on the B7 pricing document format
var SPLIT_DEMO = [
  {id:'general', label:'General Items', nbs:['A'], lineCount:8, section:'Preliminaries & General', items:[
    {ref:'1.01',desc:'Contractor\x27s general attendance; maintain site records, health and safety file, as-built drawings',qty:1,unit:'item',section:'Preliminaries'},
    {ref:'1.02',desc:'Temporary hoarding, fencing and protection to site boundary during works',qty:1,unit:'item',section:'Preliminaries'},
    {ref:'1.03',desc:'Statutory notices, fees and charges; building regulations, planning conditions and party wall awards',qty:1,unit:'item',section:'Preliminaries'},
    {ref:'1.04',desc:'Insurances — contractor all risks, public liability and employer\x27s liability to contract requirements',qty:1,unit:'item',section:'Preliminaries'},
    {ref:'1.05',desc:'Waste management and disposal; all trade waste arising from the works off site',qty:1,unit:'item',section:'Preliminaries'},
    {ref:'1.06',desc:'Cleaning on completion; full clean of all areas prior to handover',qty:1,unit:'item',section:'Preliminaries'},
    {ref:'1.07',desc:'Commissioning and testing of all new installations; attendance at witnessing',qty:1,unit:'item',section:'Preliminaries'},
    {ref:'1.08',desc:'Operation and maintenance manuals; compile and issue in electronic and hard copy format',qty:1,unit:'item',section:'Preliminaries'}
  ]},
  {id:'unallocated', label:'To Be Allocated', nbs:[], lineCount:4, section:'Unallocated Items', unallocated:true, items:[
    {ref:'9.01',desc:'Reception area feature wall — specialist decorative finish; material and technique to be confirmed with architect',qty:1,unit:'item',section:'Internal Finishes'},
    {ref:'9.02',desc:'Roof terrace decking system; composite or timber deck boards, subframe and fixings; refer to landscape architect drawings',qty:1,unit:'item',section:'External Works'},
    {ref:'9.03',desc:'Bespoke reception seating — upholstered fixed bench seating; subframe, upholstery and fabric to architect\x27s specification',qty:1,unit:'item',section:'FFE'},
    {ref:'9.04',desc:'External lighting to car park and entrance; luminaires, cabling and controls; may include mechanical and electrical elements',qty:1,unit:'item',section:'External Works'}
  ]},
  {id:'demolition', label:'Demolition & Strip Out', nbs:['C20','C90'], lineCount:18, section:'Demolition', items:[
    {ref:'2.01',desc:'Strip out existing partitions, suspended ceilings and raised access floors throughout. Remove and dispose of all arisings off site',qty:1,unit:'item',section:'Demolition Works'},
    {ref:'2.02',desc:'Remove existing sanitary ware including WCs, wash hand basins and associated pipework; dispose off site',qty:1,unit:'item'},
    {ref:'2.03',desc:'Remove existing MEP installations as identified in M&E Survey Report; cap off all services at point of disconnection',qty:1,unit:'item'},
    {ref:'2.04',desc:'Cut out existing door openings as drawings; make good all edges',qty:6,unit:'nr'},
    {ref:'2.05',desc:'Remove existing wall finishes and screed to areas identified on drawings; dispose off site',qty:1,unit:'item'},
    {ref:'2.06',desc:'Allow for asbestos watching brief throughout demolition works in accordance with Pre-Construction Information',qty:1,unit:'item'},
  ]},
  {id:'groundworks', label:'Groundworks & Drainage', nbs:['D20','R12'], lineCount:12, items:[
    {ref:'3.01',desc:'Excavation for new drainage runs; include earthwork support, dewatering and disposal of arisings',qty:1,unit:'item'},
    {ref:'3.02',desc:'110mm diameter UPVC underground drainage pipe; laid to falls, bedded and haunched in pea gravel',qty:24,unit:'m'},
    {ref:'3.03',desc:'Precast concrete inspection chambers; 450mm diameter; to invert depth not exceeding 1.5m',qty:3,unit:'nr'},
    {ref:'3.04',desc:'Reinstate hard surfaces above drainage; match existing',qty:1,unit:'item'},
  ]},
  {id:'partitions', label:'Partitions & Dry Lining', nbs:['K10','K11','K13'], lineCount:31, items:[
    {ref:'5.01',desc:'Metal stud partition system; Gypframe 92 S50 studs at 600mm centres; REI30; 15mm plasterboard both sides; skim coat finish; as K10/115',qty:1,unit:'item'},
    {ref:'5.02',desc:'Metal stud partition Type A; infill to ribbed concrete slab; Gypframe 146 S50; 80mm insulation; 15mm plasterboard; as K10/115A',qty:1,unit:'item'},
    {ref:'5.03',desc:'WC partitions; Gypframe 70 S60 studs; 50mm insulation; 12.5mm wallboard; taped, filled and painted; as K10/115B',qty:1,unit:'item'},
    {ref:'5.04',desc:'Wall lining Type A to WT1 Glazed Partition; 15mm plasterboard screw fixed; taped and skimmed; aluminium angle retaining channel; as K10/205A',qty:1,unit:'item'},
    {ref:'5.05',desc:'12mm moisture-resistant MDF (green) to WT1 Glazed Partitions at ground floor; as K11/875A',qty:1,unit:'item'},
    {ref:'5.06',desc:'12mm standard MDF (brown) to WT1 Glazed Partitions at first floor; as K11/875B',qty:1,unit:'item'},
    {ref:'5.07',desc:'12mm fire-rated MDF (pink) to WT1 Glazed Partitions at second floor; as K11/875C',qty:1,unit:'item'},
    {ref:'5.08',desc:'6mm HPL panel lining (Abet Liminati) to GF gender neutral WC cistern and sink surround; as K13/160',qty:1,unit:'item'},
    {ref:'5.09',desc:'Bespoke acoustic ceiling panel; softwood battens 25x50mm at 300mm centres; reclaimed ceiling tiles; 10mm Herdwick Wool felt; as K13/170',qty:1,unit:'item'},
  ]},
  {id:'glazing', label:'Glazed Partitions & Glazing', nbs:['G20','L40'], lineCount:14, items:[
    {ref:'5.10',desc:'Softwood studwork to WT1 Glazed Partition; 2x2 and 2x3 concealed sections; 2x4 and 2x6 exposed sections; PAR finish; as G20/401',qty:1,unit:'item'},
    {ref:'5.11',desc:'7mm Georgian wire cast bead-fixed single glazing to WT1 Glazed Partitions; 19x19x1.6mm aluminium angle both sides; 3x9mm White EPDM tape; as L40/250',qty:1,unit:'item'},
    {ref:'5.12',desc:'Fire resistant EI30 clerestory glazing to corridors; Georgian wire cast; Norseal intumescent tape; softwood beads; as L40/505',qty:1,unit:'item'},
  ]},
  {id:'doors', label:'Doors, Shutters & Hatches', nbs:['L20'], lineCount:24, items:[
    {ref:'5.13',desc:'Reuse existing single door type 611 to unit entrances; remove vision panel; infill softwood; sand; finish as M60/160B and M60/150',qty:8,unit:'nr'},
    {ref:'5.14',desc:'New FD30 fire door type 613; 44mm plywood blank; fire and smoke seals; finish as M60/150',qty:12,unit:'nr'},
    {ref:'5.15',desc:'New FD30 entrance door type 614 with Pyroshield glazing; finish as M60/160B corridor and M60/150 lobby',qty:4,unit:'nr'},
    {ref:'5.16',desc:'Double corridor doorset type 610B FD30; Pyroshield wired glazing; fire and smoke seals',qty:6,unit:'nr'},
    {ref:'5.17',desc:'Event space double doorset type 615; Georgian wired glazing; acoustic perimeter and drop seals',qty:2,unit:'nr'},
    {ref:'5.18',desc:'Electrically operated sliding folding door CDP Item 8; HAG Industrial C Door; 5410x2081mm; single phase; includes electrical connection',qty:1,unit:'nr'},
    {ref:'5.19',desc:'Fire curtains to all lift openings GF, 1F, 2F; CDP Item 1; 3500x2626mm; connection to fire alarm; as L20/810',qty:3,unit:'nr'},
  ]},
  {id:'flooring', label:'Flooring', nbs:['M50'], lineCount:16, items:[
    {ref:'6.01',desc:'Reuse existing carpet tiles 500x500mm; carefully remove, clean and dye to design document; refix with Ardex AF 825 tackifier; confirm setting out with architect',qty:1,unit:'item'},
    {ref:'6.02',desc:'Marmoleum Solid Walton linoleum 2.5mm (Forbo); ARDEX AF 785 adhesive; to event space, corridors and kitchens',qty:1,unit:'item'},
    {ref:'6.03',desc:'Surestep Balance vinyl 2.0mm (Forbo); to GF gender neutral WC; Altro coved skirting with CF20R cove former',qty:1,unit:'item'},
    {ref:'6.04',desc:'ARDEX P51 primer and ARDEX K40 levelling compound 3-40mm; to all areas receiving new floor finishes',qty:1,unit:'item'},
    {ref:'6.05',desc:'Strip existing floor coverings; dispose off site',qty:1,unit:'item'},
  ]},
  {id:'decoration', label:'Painting & Decoration', nbs:['M60'], lineCount:19, items:[
    {ref:'8.01',desc:'Dulux Trade Vinyl Matt emulsion; 1 thinned undercoat and 2 finish coats; to all internal walls; colour per finishes schedule',qty:1,unit:'item'},
    {ref:'8.02',desc:'Dulux Diamond Eggshell; 1 undercoat and 2 finish coats; to internal doors and WC skirtings',qty:1,unit:'item'},
    {ref:'8.03',desc:'Osmo Polyx Oil Tint and Wood Dye; to glazed partition studwork; colour per floor as finishes schedule',qty:1,unit:'item'},
    {ref:'8.04',desc:'Osmo Polyx Oil clear; roller applied thinly; 2 coats; to MDF panelling on WT1 partitions',qty:1,unit:'item'},
    {ref:'8.05',desc:'Morrells 5403/440 wood lacquer; airless spray; to reception desk, meeting room tables and kitchen tables',qty:1,unit:'item'},
    {ref:'8.06',desc:'Palatine Paints Carbogrip Anti Slip Floor Paint Tile Red; to external concrete paving at car park',qty:1,unit:'item'},
  ]},
  {id:'mechanical', label:'Mechanical Services', nbs:['T10','T13','T31','T60'], lineCount:42, items:[
    {ref:'12.01',desc:'Detailed survey of all retained plumbing pipework, fixtures and HVAC systems; report findings',qty:1,unit:'item'},
    {ref:'12.02',desc:'Mechanical ventilation to Events Space; including ductwork, diffusers, grilles and controls; as drawings',qty:1,unit:'item'},
    {ref:'12.03',desc:'Mechanical ventilation to IT/Comms Room, kitchen, toilets, reception and meeting rooms; including ductwork, fans and controls',qty:1,unit:'item'},
    {ref:'12.04',desc:'Air conditioning VRF system to reception and meeting rooms; indoor and outdoor units, pipework, controls and commissioning; CDP Item',qty:1,unit:'item'},
    {ref:'12.05',desc:'Repairs and upgrades to existing LTHW panel heater system; including new radiator panel sections CDP Item 7; 9no. panels',qty:9,unit:'nr'},
    {ref:'12.06',desc:'Hot and cold water services; 15mm and 22mm CPVC pipework; insulation; hot water heaters; as drawings',qty:1,unit:'item'},
    {ref:'12.07',desc:'New sanitary fittings: Duravit DuraStyle WCs with Viega concealed cistern; Duravit Vero Air basins; all with appropriate taps, wastes and connections',qty:1,unit:'item'},
    {ref:'12.08',desc:"Builder's work in connection with mechanical services; core drilling, making good, boxing in",qty:1,unit:'item'},
  ]},
  {id:'electrical', label:'Electrical Services', nbs:['V20','V21','V40'], lineCount:38, items:[
    {ref:'15.01',desc:'Survey and validation of existing electrical installations; verify operational efficiency of all retained systems',qty:1,unit:'item'},
    {ref:'15.02',desc:'Fire alarm system CDP Item 2; full contractor design and install; compatible with existing systems; connection to all relevant building systems',qty:1,unit:'item'},
    {ref:'15.03',desc:'LV distribution boards, consumer units and associated cabling as schedule; general area',qty:1,unit:'item'},
    {ref:'15.04',desc:'LED lighting installations as schedule and electrical drawings; all luminaires, drivers, wiring and connections',qty:1,unit:'item'},
    {ref:'15.05',desc:'Emergency lighting throughout; luminaires, wiring and test key; as V40/150',qty:1,unit:'item'},
    {ref:'15.06',desc:'Intruder alarms, CCTV and controlled access systems; CDP Item 3; to comply with regulations',qty:1,unit:'item'},
    {ref:'15.07',desc:"Builder's work in connection with electrical services; cutting, chasing, making good",qty:1,unit:'item'},
  ]},
  {id:'ict', label:'ICT / AV Installations', nbs:['W20','W30'], lineCount:22, items:[
    {ref:'17.01',desc:'Structured cabling infrastructure; Cat6A data outlets, patch panels, trunking and containment; as IT drawings and spec',qty:1,unit:'item'},
    {ref:'17.02',desc:'Audio visual installations; full comply with Korgi Consulting Tender Document for AV Installations v1_2; as drawings in Appendix C',qty:1,unit:'item'},
    {ref:'17.03',desc:'WiFi access points supply and installation throughout; containment, cabling and commissioning',qty:1,unit:'item'},
    {ref:'17.04',desc:'Comms room fit-out; server rack, patch panels, UPS, cooling and associated infrastructure',qty:1,unit:'item'},
  ]},
  {id:'ffe', label:'FFE & Bespoke Joinery', nbs:['N10','N11','Z10'], lineCount:28, items:[
    {ref:'11.01',desc:'Reception front desk DE_700; 2000x800x730mm; reclaimed door leaf worktop; 2x2 PAR supports; adjustable SS feet; 2no.',qty:2,unit:'nr'},
    {ref:'11.02',desc:'Kitchen island table DE_721; 2440x760x990mm; stainless steel worktop; 18mm MDF supports; 3no.',qty:3,unit:'nr'},
    {ref:'11.03',desc:'Kitchen and breakout perimeter table DE_723; 1400x600x752mm; stainless worktop; 11no.',qty:11,unit:'nr'},
    {ref:'11.04',desc:'Meeting room table DE_730; 3000x1200x750mm; 18mm MDF worktop; 4no.',qty:4,unit:'nr'},
    {ref:'11.05',desc:'Kitchen counter units DE_720; 3600x660x925mm; Howdens hi-line base units; custom 18mm MDF fronts; stainless worktops; 6no.',qty:6,unit:'nr'},
    {ref:'11.06',desc:'Integrated appliances; AEG dishwasher, AEG microwave, Liebherr fridge; 6no. each per kitchen layout',qty:18,unit:'nr'},
    {ref:'11.07',desc:'Indoor demountable stage DE_910; Litedeck 5380x1220x380mm; plywood painted matte black',qty:1,unit:'nr'},
    {ref:'11.08',desc:'Outdoor demountable stage DE_920; Litedeck 7320x3050mm; accessible ramp 1500mm wide',qty:1,unit:'nr'},
    {ref:'11.09',desc:'Event space curtain track DE_912; Triple E Ltd 2Way aluminium; M8 drop-in anchors to soffit',qty:1,unit:'item'},
    {ref:'11.10',desc:'Event space curtains; Showtex Wool Serge Red 3003; 1.5x fullness; drop 2528mm; rufflette pleat',qty:1,unit:'item'},
  ]},
  {id:'sanitaryware', label:'Sanitary Appliances', nbs:['N13'], lineCount:14, items:[
    {ref:'12.09',desc:'WC accessories to GF; Ideal Standard soap dispensers, toilet roll holders, clothes hooks, mirrors; Dryflow hand dryers; Dolphin sanitary bins and baby changing unit; as SCH605 quantities',qty:1,unit:'item'},
  ]},
  {id:'external', label:'External Works & Landscaping', nbs:['Q25','Q30'], lineCount:10, items:[
    {ref:'13.01',desc:'New bicycle storage structure to basement; as drawing DE_740; including all fixings to substrate',qty:1,unit:'item'},
    {ref:'13.02',desc:'External hard landscaping; car park line marking and signage; as drawings',qty:1,unit:'item'},
    {ref:'13.03',desc:'External anti-slip floor paint to car park; Palatine Paints Carbogrip Tile Red; mechanically abrade surface; 2 coats',qty:1,unit:'item'},
  ]},
];

function initSplit(){
  // nothing needed on init
}

function splitHandleFile(event){
  var f=event.target.files[0];
  if(f) setSplitFile(f);
}
function splitHandleDrop(event){
  event.preventDefault();
  var dz=el('split-drop-zone');
  dz.style.borderColor='var(--border)';dz.style.background='var(--bg)';
  var f=event.dataTransfer.files[0];
  if(f) setSplitFile(f);
}
function setSplitFile(f){
  splitFile = f;
  var ext = f.name.split('.').pop().toLowerCase();
  var kb = Math.round(f.size/1024);
  var sizeStr = (kb>1024?(kb/1024).toFixed(1)+' MB':kb+' KB');

  // Populate the pill
  el('split-file-name').textContent = f.name;
  el('split-file-meta').textContent = sizeStr + ' · ' + ext.toUpperCase();

  // Show pill, hide drop zone
  el('split-file-pill').style.display = 'block';
  el('sow-upload-area').style.display = 'none';
  el('sec1-ems-notice').style.display = 'none';

  // Convert button for non-CSV files
  var convertSection = el('convert-section');
  if(convertSection){
    var showConvert = ['pdf','doc','docx','xlsx','xls','xlsm'].includes(ext);
    convertSection.style.display = showConvert ? 'block' : 'none';
    el('convert-status').textContent = '';
  }

  // Mark section 1 done, then collapse after short delay
  el('sec1-num').className = 'section-num done';
  el('sec1-status').textContent = f.name.length > 18 ? f.name.substring(0,16)+'…' : f.name;
  setTimeout(function(){ collapseSection('sec1'); }, 800);

  updateCheckBtn();
}

function clearSowFile(){
  splitFile = null;
  el('split-file-pill').style.display = 'none';
  el('sow-upload-area').style.display = 'block';
  el('sec1-ems-notice').style.display = 'flex';
  el('convert-section').style.display = 'none';
  el('convert-status').textContent = '';
  el('sec1-num').className = 'section-num done';
  el('sec1-status').textContent = '';
  expandSection('sec1');
  updateCheckBtn();
}

function stepDone(i){
  el('spicon-'+i).innerHTML='&#10003;';
  el('spicon-'+i).style.cssText='width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:1px;background:var(--green-bg);color:var(--green);border:1.5px solid var(--green)';
  el('splabel-'+i).style.color='var(--green)';
}
function stepActive(i){
  var icon=el('spicon-'+i);
  icon.innerHTML='&#8635;';
  icon.style.cssText='width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0;margin-top:1px;background:var(--blue-bg);color:var(--blue);border:1.5px solid var(--blue);animation:spin 1s linear infinite';
  el('splabel-'+i).style.cssText='font-size:13px;color:var(--blue);font-weight:600';
}
function stepError(i,msg){
  el('spicon-'+i).innerHTML='&#10007;';
  el('spicon-'+i).style.cssText='width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:1px;background:var(--red-bg);color:var(--red);border:1.5px solid var(--red)';
  el('splabel-'+i).style.color='var(--red)';
  if(msg){
    var errDiv=document.createElement('div');
    errDiv.style.cssText='font-size:11.5px;color:var(--red);margin-top:4px';
    errDiv.textContent=msg;
    el('spstep-'+i).appendChild(errDiv);
  }
}

async function runSplit(){
  if(!splitFile){alert('Please upload a schedule of works document first.');return;}
  el('split-empty').style.display='none';
  el('split-results').style.display='none';
  el('split-processing').style.display='flex';
  el('split-run-btn').disabled=true;
  el('split-proc-file').textContent='Reading: '+splitFile.name;

  var steps=[
    {label:'Reading document',detail:'Parsing file format and extracting content'},
    {label:'Extracting NBS work sections',detail:'Scanning for NBS codes: C, D, G, K, L, M, N, T, V, W series'},
    {label:'Identifying section headings & line items',detail:'Parsing headings, item references, descriptions and quantities'},
    {label:'Classifying items to trades',detail:'Mapping sections to DCK trade packages'},
    {label:'Building trade pricing documents',detail:'Generating one Excel-ready document per trade'},
  ];

  el('split-steps').innerHTML=steps.map(function(s,i){
    return '<div id="spstep-'+i+'" style="display:flex;align-items:flex-start;gap:12px;padding:13px 18px;border-bottom:1px solid var(--border)">'+
      '<div id="spicon-'+i+'" style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:1px;background:var(--bg);color:var(--text-hint);border:1.5px solid var(--border)">'+(i+1)+'</div>'+
      '<div style="flex:1"><div id="splabel-'+i+'" style="font-size:13px;color:var(--text-mid)">'+s.label+'</div>'+
      '<div style="font-size:11.5px;color:var(--text-hint);margin-top:2px">'+s.detail+'</div></div></div>';
  }).join('');

  // Step 0: Read & parse file
  stepActive(0);
  var prepared;
  try {
    prepared = await prepareFileContent(splitFile);
    stepDone(0);
  } catch(e) {
    stepError(0, 'Failed to read file: '+e.message);
    el('split-run-btn').disabled=false;
    return;
  }

  // Steps 1-4: AI call
  stepActive(1);
  var projName = el('split-proj-name').value || 'Project';
  var client = el('split-client').value || '';
  var method = el('split-method').value;
  var inclPrelims = el('split-prelims').checked;
  var inclBwic = el('split-bwic').checked;

  var systemPrompt = 'You are a construction estimating assistant for DCK Construction Ltd. You analyse schedules of works / bills of quantities and split them into trade packages.\n\n'+
    'Return a JSON array of trade objects. Each object:\n'+
    '{"id":"snake_case_id","label":"Trade name","nbs":["NBS","codes"],"section":"Primary section","lineCount":N,"items":[{"ref":"1.01","desc":"description","qty":1,"unit":"item","section":"Section heading"}]}\n\n'+
    'Rules:\n'+
    '- Use these IDs where applicable: general, demolition, groundworks, partitions, glazing, doors, flooring, decoration, mechanical, electrical, ict, ffe, sanitaryware, external. Create new snake_case IDs for others.\n'+
    '- Unclassifiable items → id "unallocated", label "To Be Allocated".\n'+
    (inclPrelims ? '- Include a "general" trade for preliminaries.\n' : '- Omit preliminaries.\n')+
    (inclBwic ? '- Include builders work items in the relevant trade.\n' : '- Omit builders work items.\n')+
    '- Trade identification: '+(method==='nbs'?'NBS codes primarily':method==='headings'?'Section headings primarily':'NBS codes + section headings')+'.\n'+
    '- Extract EVERY line item with ref, description, quantity and unit. Set lineCount = items.length.\n'+
    '- Project: '+projName+(client?', Client: '+client:'')+'.\n\n'+
    'Respond ONLY with a valid JSON array — no markdown, no preamble.';

  var userContent = buildApiContent(prepared, 'Split this schedule of works into trade packages. Return only a JSON array as instructed.');

  try {
    // Animate steps 1–2 while waiting for response
    setTimeout(function(){ stepDone(1); stepActive(2); }, 500);
    setTimeout(function(){ stepDone(2); stepActive(3); }, 1200);

    // Use streaming so we can show live progress
    var resp = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:16000,
        stream:true,
        system:systemPrompt,
        messages:[{role:'user', content:userContent}]
      })
    });

    if(!resp.ok){
      var errData = await resp.json().catch(function(){return {};});
      throw new Error(errData.error && errData.error.message ? errData.error.message : 'API error '+resp.status);
    }

    // Read stream and show live character count
    var reader = resp.body.getReader();
    var decoder = new TextDecoder();
    var rawAccum = '';
    var tokenCount = 0;

    stepDone(3); stepActive(4);
    var liveLabel = el('splabel-4');

    while(true){
      var chunk = await reader.read();
      if(chunk.done) break;
      var text = decoder.decode(chunk.value, {stream:true});
      // SSE lines
      text.split('\n').forEach(function(line){
        if(!line.startsWith('data:')) return;
        var json = line.slice(5).trim();
        if(json === '[DONE]') return;
        try {
          var evt = JSON.parse(json);
          if(evt.type === 'content_block_delta' && evt.delta && evt.delta.text){
            rawAccum += evt.delta.text;
            tokenCount++;
            // Update live label every ~20 chunks
            if(tokenCount % 20 === 0 && liveLabel){
              var tradeCount = (rawAccum.match(/"id"\s*:/g)||[]).length;
              liveLabel.textContent = 'Building trade documents' + (tradeCount > 0 ? ' — '+tradeCount+' trade'+(tradeCount===1?'':'s')+' identified…' : '…');
            }
          }
        } catch(e){}
      });
    }

    if(liveLabel) liveLabel.textContent = 'Finalising trade documents';

    var cleaned = rawAccum.trim().replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim();
    var parsed = JSON.parse(cleaned);

    if(!Array.isArray(parsed) || parsed.length === 0) throw new Error('AI returned empty or invalid trade list');

    parsed.forEach(function(t){
      if(!t.lineCount) t.lineCount = (t.items||[]).length;
      if(!t.items) t.items = [];
      if(!t.nbs) t.nbs = [];
    });

    stepDone(4);
    splitTrades = parsed;
    splitActiveTrade = splitTrades[0] ? splitTrades[0].id : null;
    setTimeout(showSplitResults, 300);

  } catch(e) {
    stepError(4, 'AI processing failed: '+e.message+'. Showing demo data instead.');
    splitTrades = SPLIT_DEMO;
    splitActiveTrade = splitTrades[0].id;
    setTimeout(showSplitResults, 1200);
  }
}

function showSplitResults(){
  el('split-processing').style.display='none';
  el('split-results').style.display='flex';
  el('split-run-btn').disabled=false;
  var totalItems=splitTrades.reduce(function(s,t){return s+t.lineCount;},0);
  el('split-result-title').textContent=splitTrades.length+' trades identified';
  el('split-result-sub').textContent=totalItems+' line items across '+splitTrades.length+' pricing documents';
  renderSplitTradeList();
  renderSplitPreview(splitActiveTrade);
}

function renderSplitTradeList(){
  var container=el('split-trade-list');
  container.innerHTML='';
  splitTrades.forEach(function(t){
    var isActive=t.id===splitActiveTrade;
    var isUnalloc=t.id==='unallocated';
    var isGeneral=t.id==='general';
    var col=TRADE_COLOURS[t.id]||{bg:'#F0F0F5',border:'#9BA3BF',text:'#4A5272'};
    var btn=document.createElement('button');
    btn.setAttribute('data-trade-id',t.id);
    var borderL=isActive?'var(--navy)':(isUnalloc?'var(--red)':isGeneral?'var(--text-hint)':'transparent');
    btn.style.cssText='width:100%;padding:10px 14px;text-align:left;background:'+(isActive?'var(--navy-lt)':'transparent')+';border:none;border-left:3px solid '+borderL+';cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);font-family:DM Sans,sans-serif';
    var nbsBadges=t.nbs&&t.nbs.length?t.nbs.map(function(n){
      return '<span style="background:var(--purple-bg);color:var(--purple);padding:1px 5px;border-radius:8px;font-size:10px;font-weight:600;margin-right:3px">'+n+'</span>';
    }).join(''):'';
    var labelStyle='font-size:12.5px;font-weight:'+(isActive?'600':'400')+';color:'+(isUnalloc?'var(--red)':isActive?'var(--navy)':'var(--text-mid)')+'';
    var countStyle='font-size:11px;color:'+(isUnalloc&&t.lineCount>0?'var(--red)':'var(--text-hint)')+';font-weight:'+(isUnalloc&&t.lineCount>0?'600':'400')+'';
    btn.innerHTML='<div style="flex:1;min-width:0">'+
      '<div style="'+labelStyle+'">'+(isUnalloc?'&#9888; ':isGeneral?'&#9685; ':'')+esc(t.label)+'</div>'+
      '<div style="font-size:11px;color:var(--text-hint);margin-top:2px">'+nbsBadges+'</div>'+
    '</div>'+
    '<div style="text-align:right;flex-shrink:0;margin-left:8px">'+
      '<div style="'+countStyle+'">'+t.lineCount+' items</div>'+
    '</div>';
    btn.onclick=function(){selectSplitTrade(this.getAttribute('data-trade-id'));};
    container.appendChild(btn);
  });
}

function selectSplitTrade(id){
  splitActiveTrade=id;
  renderSplitTradeList();
  renderSplitPreview(id);
}

function renderSplitPreview(id){
  var t=splitTrades.find(function(x){return x.id===id;});
  if(!t)return;
  var isUnalloc=t.id==='unallocated';
  var isGeneral=t.id==='general';
  var filename=t.label.replace(/[^a-zA-Z0-9 ]/g,'').replace(/\s+/g,'-')+'_Pricing.xlsx';
  var col=TRADE_COLOURS[t.id]||{bg:'#F0F0F5',border:'#9BA3BF',text:'#4A5272'};
  var nbsBadges=t.nbs&&t.nbs.length
    ?t.nbs.map(function(n){return '<span class="badge b-purple" style="margin-right:4px">'+n+'</span>';}).join('')
    :'<span class="badge" style="background:'+col.bg+';color:'+col.text+';border:1px solid '+col.border+'">'+esc(t.label)+'</span>';

  var headerDiv=document.createElement('div');
  headerDiv.className='flex-b mb16';
  headerDiv.innerHTML=
    '<div>'+
      '<div style="font-size:17px;font-weight:700;color:'+(isUnalloc?'var(--red)':'var(--text)')+'">'+
        (isUnalloc?'&#9888; ':isGeneral?'&#9685; ':'')+esc(t.label)+
      '</div>'+
      '<div style="font-size:12px;color:var(--text-light);margin-top:3px">'+nbsBadges+' &middot; '+t.lineCount+' items</div>'+
      (isUnalloc?'<div style="font-size:12px;color:var(--red);margin-top:5px">These items could not be automatically assigned to a trade — use the Allocate button to assign each one manually.</div>':'')+
    '</div>';

  var actionDiv=document.createElement('div');
  actionDiv.className='flex-g';
  if(!isUnalloc){
    var dlBtn=document.createElement('button');
    dlBtn.className='btn btn-primary btn-sm';
    dlBtn.innerHTML='&#8681; Download Excel';
    dlBtn.setAttribute('data-trade-id',id);
    dlBtn.onclick=function(){downloadTradeExcel(this.getAttribute('data-trade-id'));};
    actionDiv.appendChild(dlBtn);
  }
  headerDiv.appendChild(actionDiv);

  // Group items by section
  var sectionGroups={}, sectionOrder=[];
  (t.items||[]).forEach(function(item){
    var sec=item.section||t.label;
    if(!sectionGroups[sec]){sectionGroups[sec]=[];sectionOrder.push(sec);}
    sectionGroups[sec].push(item);
  });

  // Build table per section
  var colW='50px 70px 1fr 50px 50px 90px 90px';
  var hdrRow=['','Item','Description','Qty','Unit','Rate (£)','Total (£)'].map(function(h,i){
    return '<div style="padding:6px 8px;font-size:10px;font-weight:700;color:#1B3A6B;text-align:'+(i<=1||i===3||i===4?'center':'left')+'">'+h+'</div>';
  }).join('');

  var tableHTML='<div class="card" style="overflow:hidden;margin-bottom:14px">';

  // Navy file header
  if(!isUnalloc){
    tableHTML+='<div style="padding:10px 16px;background:var(--navy);display:flex;justify-content:space-between;align-items:center">'+
      '<div style="font-size:12px;font-weight:700;color:#fff">'+esc(filename)+'</div>'+
      '<span style="font-size:10px;background:rgba(255,255,255,.15);color:#fff;padding:2px 8px;border-radius:10px;font-weight:600">EXCEL PREVIEW</span>'+
    '</div>';
  }

  // Column headers
  tableHTML+='<div style="display:grid;grid-template-columns:'+colW+';background:#D0D8E8;border-bottom:1px solid var(--border)">'+hdrRow+'</div>';

  var globalRow=0;
  sectionOrder.forEach(function(sectionName){
    var sItems=sectionGroups[sectionName];
    // Section heading row (spans all cols)
    tableHTML+='<div style="display:grid;grid-template-columns:'+colW+';background:#1B3A6B">'+
      '<div style="grid-column:1/-1;padding:7px 12px;font-size:11px;font-weight:700;color:#fff;letter-spacing:.04em">'+
        '&#9654; '+esc(sectionName)+
      '</div>'+
    '</div>';

    sItems.forEach(function(item){
      var bg=globalRow%2===0?'#fff':'#F8F9FC';
      globalRow++;
      tableHTML+='<div style="display:grid;grid-template-columns:'+colW+';background:'+bg+';border-bottom:1px solid #F0F0F5">'+
        '<div style="padding:7px 8px;font-size:11px;text-align:center;color:#888">'+globalRow+'</div>'+
        '<div style="padding:7px 8px;font-size:11px;font-weight:600;color:#1B3A6B;text-align:center">'+esc(item.ref)+'</div>'+
        '<div style="padding:7px 8px;font-size:11px;color:#333;line-height:1.4">'+esc(item.desc)+
          (item.note?'<div style="font-size:10.5px;color:var(--amber);margin-top:2px;font-style:italic">'+esc(item.note)+'</div>':'')+
        '</div>'+
        '<div style="padding:7px 8px;font-size:11px;text-align:center">'+item.qty+'</div>'+
        '<div style="padding:7px 8px;font-size:11px;text-align:center;color:#666">'+esc(item.unit)+'</div>'+
        (function(){
          if(isUnalloc){
            var ab=document.createElement('div');
            ab.style.cssText='padding:7px 8px;grid-column:6/8;display:flex;align-items:center;justify-content:center';
            var b=document.createElement('button');
            b.style.cssText='padding:4px 10px;background:var(--navy);border:none;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;color:#fff;font-family:DM Sans,sans-serif';
            b.textContent='Allocate →';
            b.setAttribute('data-ref',item.ref);
            b.setAttribute('data-desc',item.desc);
            b.onclick=function(){openAllocateModal(this.getAttribute('data-ref'),this.getAttribute('data-desc'));};
            ab.appendChild(b);
            return ab.outerHTML;
          }
          return '<div style="padding:7px 8px;font-size:11px;text-align:right;color:#0000FF;background:#F0F4FF">&pound;0.00</div>'+
                 '<div style="padding:7px 8px;font-size:11px;text-align:right;color:#555">=D*F</div>';
        })()+
      '</div>';
    });
  });

  if(!isUnalloc&&t.items.length<t.lineCount){
    tableHTML+='<div style="padding:8px 16px;font-size:11px;color:var(--text-hint);text-align:center;background:var(--bg)">... '+(t.lineCount-t.items.length)+' further line items in full Excel file</div>';
  }

  if(!isUnalloc){
    tableHTML+='<div style="display:grid;grid-template-columns:'+colW+';background:#1B3A6B">'+
      '<div style="grid-column:1/6;padding:8px;font-size:12px;font-weight:700;color:#fff;padding-left:16px">TOTAL (Excl. VAT)</div>'+
      '<div style="grid-column:6/8;padding:8px;font-size:12px;font-weight:700;color:#fff;text-align:right">=SUM</div>'+
    '</div>';
  }
  tableHTML+='</div>';

  var infoBox = isUnalloc
    ?'<div style="background:var(--red-bg);border:1px solid rgba(196,43,28,.15);border-radius:6px;padding:12px 16px;font-size:12.5px;color:var(--red)">'+
       '&#9888; &nbsp;'+t.items.length+' item'+(t.items.length===1?'':'s')+' need manual allocation. Click <strong>Allocate &rarr;</strong> on each item to assign it to a trade.'+
     '</div>'
    :'<div style="background:var(--blue-bg);border:1px solid rgba(15,108,189,.2);border-radius:6px;padding:12px 16px;font-size:12.5px;color:var(--blue)">'+
       '&#9432; &nbsp;Full Excel contains all <strong>'+t.lineCount+' line items</strong> grouped by section heading. Rate cells (blue) are editable.'+
     '</div>';

  var panel=el('split-preview-panel');
  panel.innerHTML='';
  // Render headerDiv (DOM element) + tableHTML (string) + infoBox (string)
  var wrapper=document.createElement('div');
  wrapper.appendChild(headerDiv);
  panel.appendChild(wrapper);
  panel.insertAdjacentHTML('beforeend', tableHTML + infoBox);
}

function editSplitTrade(id){alert('Edit mode: you can add, remove or rename line items before downloading.');}
function downloadTradeExcel(id){
  var t=splitTrades.find(function(x){return x.id===id;});
  if(!t)return;
  var fname=t.label.replace(/[^a-zA-Z0-9 ]/g,'').replace(/\s+/g,'-')+'_Pricing.xlsx';
  alert('Downloading: '+fname+' ('+t.lineCount+' line items). In production this generates a formatted Excel matching your existing pricing document templates.');
}
function downloadAllExcel(){
  alert('Downloading all '+splitTrades.length+' trade pricing documents as ZIP. In production this calls the Excel generator to build all files in the same format as your existing pricing documents.');
}
function sendToEnquiry(){
  alert(splitTrades.length+' trade packages sent to Enquiry Generation module. Trades are now available in Module 4.');
}
function resetSplit(){
  splitFile=null; splitTrades=[]; splitActiveTrade=null;
  // Restore SOW section
  el('split-file-pill').style.display='none';
  el('sow-upload-area').style.display='block';
  el('sec1-ems-notice').style.display='flex';
  el('sec1-status').textContent='';
  el('sec1-num').className='section-num done';
  var cs=el('convert-section'); if(cs) cs.style.display='none';
  var cs2=el('convert-status'); if(cs2) cs2.textContent='';
  expandSection('sec1');
  // Restore results area
  el('split-empty').style.display='flex';
  el('split-results').style.display='none';
  el('split-processing').style.display='none';
  el('split-run-btn').disabled=false;
}


function exportToEMS(){
  alert(splitTrades.length+' trade packages ready. Open the EMS and the trades will be available in the Enquiry Generation module.');
}


function renderSharedItems(){
  var panel=el('shared-items-panel');
  var tradeColor={'Mechanical Services':'var(--teal)','Electrical Services':'var(--blue)','ICT / AV Installations':'var(--purple)','Doors, Shutters & Hatches':'var(--amber)','Sanitary Appliances':'var(--green)'};

  var headerHTML='<div class="flex-b mb16">'+
    '<div>'+
      '<div style="font-size:18px;font-weight:700;color:var(--text)">Shared Items</div>'+
      '<div style="font-size:13px;color:var(--text-light);margin-top:2px">'+SHARED_ITEMS.length+' items identified that span multiple trades</div>'+
    '</div>'+
    '<button class="btn btn-secondary btn-sm" onclick="exportSharedItems()">&#8681; Export Schedule</button>'+
  '</div>'+
  '<div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">'+
    '<span style="font-size:12px;color:var(--text-mid);display:flex;align-items:center;gap:5px"><span style="width:12px;height:12px;border-radius:2px;background:var(--amber-bg);border:1px solid rgba(196,123,0,.3);display:inline-block"></span>Lead trade</span>'+
    '<span style="font-size:12px;color:var(--text-mid);display:flex;align-items:center;gap:5px"><span style="width:12px;height:12px;border-radius:2px;background:var(--blue-bg);border:1px solid rgba(15,108,189,.3);display:inline-block"></span>Supporting trade</span>'+
  '</div>';

  panel.innerHTML=headerHTML;

  SHARED_ITEMS.forEach(function(item){
    var card=document.createElement('div');
    card.style.cssText='background:var(--white);border:1px solid var(--border);border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05);margin-bottom:16px';

    // Card header
    var tradeBadges=item.trades.map(function(t){
      var col=tradeColor[t.trade]||'var(--text-mid)';
      return '<span style="font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;background:'+col+'18;color:'+col+';border:1px solid '+col+'28">'+(t.lead?'&#9733; ':'')+esc(t.trade)+'</span>';
    }).join(' ');

    var hdr=document.createElement('div');
    hdr.style.cssText='padding:13px 18px;background:var(--bg);border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:14px';
    hdr.innerHTML='<span style="font-size:11px;font-weight:700;color:var(--text-light);background:var(--white);border:1px solid var(--border);padding:3px 8px;border-radius:4px;flex-shrink:0;margin-top:1px">'+esc(item.ref)+'</span>'+
      '<div style="flex:1">'+
        '<div style="font-size:13.5px;font-weight:600;color:var(--text);line-height:1.4">'+esc(item.desc)+'</div>'+
        '<div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+
          '<span style="font-size:11px;font-weight:700;color:var(--amber);background:var(--amber-bg);border:1px solid rgba(196,123,0,.2);padding:2px 8px;border-radius:10px">&#9888; '+item.trades.length+' trades</span>'+
          tradeBadges+
        '</div>'+
      '</div>';

    var editBtn=document.createElement('button');
    editBtn.textContent='Edit';
    editBtn.style.cssText='flex-shrink:0;background:transparent;border:1px solid var(--border);border-radius:4px;padding:5px 10px;font-size:12px;font-weight:600;cursor:pointer;color:var(--text-mid);font-family:DM Sans,sans-serif';
    editBtn.setAttribute('data-item-id', item.id);
    editBtn.onclick=function(){editLeadTrade(this.getAttribute('data-item-id'));};
    hdr.appendChild(editBtn);
    card.appendChild(hdr);

    // Trade rows
    item.trades.forEach(function(t){
      var col=tradeColor[t.trade]||'var(--text-mid)';
      var isLead=t.lead;
      var row=document.createElement('div');
      row.style.cssText='padding:13px 18px;border-bottom:1px solid var(--border);background:'+(isLead?'rgba(196,123,0,.04)':'rgba(15,108,189,.03)')+';border-left:3px solid '+(isLead?'var(--amber)':'var(--blue)');
      row.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">'+
          '<span style="font-size:11px;font-weight:700;padding:2px 9px;border-radius:10px;background:'+col+'18;color:'+col+';border:1px solid '+col+'28">'+(isLead?'&#9733; LEAD':'SUPPORTING')+'</span>'+
          '<span style="font-size:13px;font-weight:600;color:var(--text)">'+esc(t.trade)+'</span>'+
          '<span style="font-size:11px;color:var(--text-hint)">'+esc(t.nbs)+'</span>'+
        '</div>'+
        '<div style="font-size:12.5px;color:var(--text-mid);line-height:1.6;margin-bottom:6px"><strong style="color:var(--text)">Scope: </strong>'+esc(t.scope)+'</div>'+
        '<div style="font-size:11.5px;font-style:italic;color:'+(isLead?'var(--amber)':'var(--blue)')+'">'+esc(t.note)+'</div>';

      // Editable note field
      var noteWrap=document.createElement('div');
      noteWrap.style.marginTop='8px';
      var noteInput=document.createElement('input');
      noteInput.type='text';
      noteInput.placeholder='Add coordination note for enquiry email...';
      noteInput.style.cssText='width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:4px;font-size:12px;color:var(--text);background:var(--white);font-family:DM Sans,sans-serif';
      noteInput.id='note-'+item.id+'-'+t.nbs;
      noteWrap.appendChild(noteInput);
      row.appendChild(noteWrap);
      card.appendChild(row);
    });

    panel.appendChild(card);
  });
}

function editLeadTrade(itemId){
  alert('In the full version, you can reassign which trade leads and which supports, and override the AI-detected scope split for each trade.');
}

// Override showSplitResults to also update shared badge and flag items in trade previews
// Patch showSplitResults to also update shared badge
var _baseSplitResults = showSplitResults;
showSplitResults = function(){
  _baseSplitResults();
  var badge = el('shared-count-badge');
  if(badge){
    badge.textContent = SHARED_ITEMS.length;
    badge.style.background = SHARED_ITEMS.length > 0 ? 'var(--amber-bg)' : 'var(--bg)';
  }
};



// ── EXCEL PARSING VIA SHEETJS ─────────────────────────────
async function readFileAsText(file) {
  var ext = file.name.split('.').pop().toLowerCase();
  // Excel files: parse with SheetJS → CSV text
  if(['xlsx','xls','xlsm','xltx'].includes(ext)) {
    return await readExcelAsCSV(file);
  }
  // CSV / plain text / Word (docx read as raw text — imperfect but functional)
  return await new Promise(function(resolve){
    var r = new FileReader();
    r.onload = function(){ resolve(r.result || ''); };
    r.onerror = function(){ resolve(''); };
    r.readAsText(file);
  });
}

async function readExcelAsCSV(file) {
  // Load SheetJS if not already loaded
  if(typeof XLSX === 'undefined') {
    await new Promise(function(resolve, reject){
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  var buf = await new Promise(function(resolve, reject){
    var r = new FileReader();
    r.onload = function(){ resolve(r.result); };
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });
  var wb = XLSX.read(buf, {type:'array'});
  // Convert all sheets to CSV, concatenated
  var csv = wb.SheetNames.map(function(name){
    var ws = wb.Sheets[name];
    return '=== Sheet: '+name+' ===\n'+XLSX.utils.sheet_to_csv(ws);
  }).join('\n\n');
  return csv;
}

async function readFileAsBase64(file) {
  return await new Promise(function(resolve, reject){
    var r = new FileReader();
    r.onload = function(){ resolve(r.result.split(',')[1]); };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function prepareFileContent(file) {
  // Returns {type:'pdf'|'image'|'text', content:string, mediaType:string|null}
  var ext = file.name.split('.').pop().toLowerCase();
  if(ext === 'pdf') {
    var b64 = await readFileAsBase64(file);
    return {type:'pdf', content:b64, mediaType:'application/pdf'};
  }
  if(['png','jpg','jpeg','gif','webp'].includes(ext)) {
    var b64 = await readFileAsBase64(file);
    return {type:'image', content:b64, mediaType:'image/'+ext};
  }
  // Excel, CSV, Word, etc. → extract as text
  var text = await readFileAsText(file);
  if(!text || text.trim().length < 10) {
    throw new Error('Could not read file content — file may be empty or corrupt.');
  }
  return {type:'text', content:text, mediaType:null};
}

function buildApiContent(prepared, promptText) {
  if(prepared.type === 'pdf') {
    return [
      {type:'document', source:{type:'base64', media_type:prepared.mediaType, data:prepared.content}},
      {type:'text', text:promptText}
    ];
  }
  if(prepared.type === 'image') {
    return [
      {type:'image', source:{type:'base64', media_type:prepared.mediaType, data:prepared.content}},
      {type:'text', text:promptText}
    ];
  }
  // text
  return promptText + '\n\nDocument content:\n' + prepared.content.substring(0, 80000);
}

// ── STUB FOR MISSING FUNCTION ─────────────────────────────
function exportSharedItems(){
  alert('Exporting shared items schedule... (full export available in the EMS)');
}



// ── TRADE COLOURS ─────────────────────────────────────────
var TRADE_COLOURS = {
  'general':     {bg:'#F0F0F5',border:'#9BA3BF',text:'#4A5272',label:'General'},
  'unallocated': {bg:'#FDF2F2',border:'#C42B1C',text:'#C42B1C',label:'Unallocated'},
  'demolition':  {bg:'#FFF8E6',border:'#C47B00',text:'#C47B00',label:'Demolition'},
  'groundworks': {bg:'#EBF7F7',border:'#0D7377',text:'#0D7377',label:'Groundworks'},
  'partitions':  {bg:'#EFF6FC',border:'#0F6CBD',text:'#0F6CBD',label:'Partitions'},
  'glazing':     {bg:'#F4F0FB',border:'#5B3DA8',text:'#5B3DA8',label:'Glazing'},
  'doors':       {bg:'#FFF8E6',border:'#C47B00',text:'#C47B00',label:'Doors'},
  'flooring':    {bg:'#EFF8EF',border:'#107C10',text:'#107C10',label:'Flooring'},
  'decoration':  {bg:'#EBF7F7',border:'#0D7377',text:'#0D7377',label:'Decoration'},
  'mechanical':  {bg:'#FDF2F2',border:'#C42B1C',text:'#C42B1C',label:'Mechanical'},
  'electrical':  {bg:'#EFF6FC',border:'#0F6CBD',text:'#0F6CBD',label:'Electrical'},
  'ict':         {bg:'#F4F0FB',border:'#5B3DA8',text:'#5B3DA8',label:'ICT / AV'},
  'ffe':         {bg:'#EFF8EF',border:'#107C10',text:'#107C10',label:'FFE & Joinery'},
  'sanitaryware':{bg:'#EBF7F7',border:'#0D7377',text:'#0D7377',label:'Sanitary'},
  'external':    {bg:'#FFF8E6',border:'#C47B00',text:'#C47B00',label:'External'}
};

// ── SHARED ITEMS ──────────────────────────────────────────
var SHARED_ITEMS = [
  {id:'sh1',ref:'12.04',desc:'Air conditioning VRF system to reception and meeting rooms; indoor and outdoor units, pipework, controls and commissioning; CDP Item',
   trades:[
    {trade:'Mechanical Services',nbs:'T31',lead:true,scope:'Supply and install VRF system; indoor and outdoor units; all refrigerant pipework, insulation and brackets; commissioning of plant and controls',note:'LEAD TRADE — responsible for full system design and commissioning'},
    {trade:'Electrical Services',nbs:'V20',lead:false,scope:'Electrical supply and connection to VRF outdoor condensers; 20A isolators; wiring from distribution board to each unit; connection to BMS controls',note:'SUPPORTING TRADE — electrical connection only, mechanical contractor coordinates'}
   ]},
  {id:'sh2',ref:'12.05',desc:'Repairs and upgrades to existing LTHW panel heater system including new radiator panel sections CDP Item 7; 9no. panels',
   trades:[
    {trade:'Mechanical Services',nbs:'T10',lead:true,scope:'Strip down existing radiator panels; carry out repairs; supply and install 9no. new radiator panel sections; LTHW pipework connections and controls',note:'LEAD TRADE — full mechanical scope including pipework and controls'},
    {trade:'Electrical Services',nbs:'V20',lead:false,scope:'Electrical connection to new heating controls and thermostats; wiring from existing circuits; testing and commissioning of electrical elements',note:'SUPPORTING TRADE — controls wiring only'}
   ]},
  {id:'sh3',ref:'15.02',desc:'Fire alarm system CDP Item 2; full contractor design and install; compatible with existing systems; connection to all relevant building systems',
   trades:[
    {trade:'Electrical Services',nbs:'V20',lead:true,scope:'Full contractor design and install of fire alarm system; detectors, sounders, call points, control panel, wiring and containment; commissioning',note:'LEAD TRADE — CDP Item, full design responsibility'},
    {trade:'Mechanical Services',nbs:'T10',lead:false,scope:'Interface and connection of mechanical ventilation systems to fire alarm; smoke dampers; witnessing of commissioning',note:'SUPPORTING TRADE — M&E interface only'},
    {trade:'ICT / AV Installations',nbs:'W20',lead:false,scope:'Interface of access control and security systems with fire alarm; connection of door release mechanisms to fire alarm outputs',note:'SUPPORTING TRADE — security system interface only'}
   ]},
  {id:'sh4',ref:'5.18',desc:'Electrically operated sliding folding door CDP Item 8; HAG Industrial C Door; 5410x2081mm; single phase; includes electrical connection',
   trades:[
    {trade:'Doors, Shutters & Hatches',nbs:'L20',lead:true,scope:'Supply and install sliding folding door; full installation and adjustment',note:'LEAD TRADE — supply and mechanical installation'},
    {trade:'Electrical Services',nbs:'V20',lead:false,scope:'Electrical connection to sliding folding door motor; single phase supply; push button controls; testing and commissioning',note:'SUPPORTING TRADE — electrical connection and controls only'}
   ]},
  {id:'sh5',ref:'13.03',desc:'Hand dryers; Dryflow JetDri MKII Carbon Neutral; includes supply, fix and electrical connection from unswitched FCU',
   trades:[
    {trade:'Sanitary Appliances',nbs:'N13',lead:true,scope:'Supply and fix Dryflow JetDri MKII Carbon Neutral hand dryers to walls; secure fixing to substrate',note:'LEAD TRADE — supply and mechanical fixing'},
    {trade:'Electrical Services',nbs:'V20',lead:false,scope:'Supply and install unswitched FCU adjacent to each hand dryer; wiring from nearest distribution point; final connection to hand dryer',note:'SUPPORTING TRADE — FCU and final electrical connection'}
   ]},
  {id:'sh6',ref:'5.19',desc:'Fire curtains to all lift openings GF, 1F, 2F; CDP Item 1; connection to fire alarm',
   trades:[
    {trade:'Doors, Shutters & Hatches',nbs:'L20',lead:true,scope:'Supply and install fire curtains to all lift openings; 3500x2626mm; fixed to concrete; full CDP contractor design responsibility',note:'LEAD TRADE — CDP Item, full design and installation'},
    {trade:'Electrical Services',nbs:'V20',lead:false,scope:'Connection of fire curtain release mechanism to fire alarm system; wiring and interface with fire alarm panel outputs',note:'SUPPORTING TRADE — fire alarm interface and electrical connection only'}
   ]}
];

// ── SETTINGS TOGGLE ───────────────────────────────────────
// ── SECTION COLLAPSE ─────────────────────────────────────
function toggleSection(id){
  var body = el(id+'-body');
  if(!body) return;
  if(body.classList.contains('collapsed')) expandSection(id);
  else collapseSection(id);
}

function collapseSection(id){
  var body = el(id+'-body');
  var chevron = el(id+'-chevron');
  if(!body) return;
  body.style.maxHeight = '0';
  body.classList.add('collapsed');
  if(chevron) chevron.classList.remove('open');
}

function expandSection(id){
  var body = el(id+'-body');
  var chevron = el(id+'-chevron');
  if(!body) return;
  body.classList.remove('collapsed');
  body.style.maxHeight = body.scrollHeight + 200 + 'px'; // generous for dynamic content
  if(chevron) chevron.classList.add('open');
}



// ── SWITCH RESULT TAB ─────────────────────────────────────
function switchResultTab(tab){
  ['schedule','trades','shared','compliance','revision'].forEach(function(t){
    var panel=el('rpanel-'+t),btn=el('rtab-'+t);
    if(!panel||!btn)return;
    var isActive=t===tab;
    panel.style.display=isActive?(t==='trades'||t==='schedule'?'flex':'block'):'none';
    btn.style.cssText='padding:10px 16px;background:transparent;border:none;border-bottom:3px solid '+(isActive?'var(--navy)':'transparent')+';font-size:13px;font-weight:'+(isActive?'700':'500')+';color:'+(isActive?'var(--navy)':'var(--text-light)')+';cursor:pointer;font-family:DM Sans,sans-serif';
  });
  if(tab==='shared')renderSharedItems();
  if(tab==='schedule')renderScheduleView();
}

// ── MAKE ALLOC BTN HELPER ─────────────────────────────────
function makeAllocBtn(ref,desc){
  var b=document.createElement('button');
  b.style.cssText='padding:2px 7px;background:transparent;border:1px solid var(--red);border-radius:4px;font-size:10px;font-weight:600;color:var(--red);cursor:pointer;font-family:DM Sans,sans-serif';
  b.textContent='Allocate';
  b.setAttribute('data-ref',ref);b.setAttribute('data-desc',desc);
  b.onclick=function(){openAllocateModal(this.getAttribute('data-ref'),this.getAttribute('data-desc'));};
  return b.outerHTML;
}

// ── SCHEDULE VIEW ─────────────────────────────────────────
var scheduleChanges={};

function renderScheduleView(){
  var panel=el('schedule-panel');
  if(!panel)return;
  var allItems=[];
  splitTrades.forEach(function(t){
    (t.items||[]).forEach(function(item){
      allItems.push({ref:item.ref,desc:item.desc,qty:item.qty,unit:item.unit,
        section:item.section||t.label,tradeId:t.id,tradeLabel:t.label});
    });
  });
  allItems.sort(function(a,b){return String(a.ref).localeCompare(String(b.ref),undefined,{numeric:true});});
  var tradeOptions=splitTrades.map(function(t){return '<option value="'+escQ(t.id)+'">'+esc(t.label)+'</option>';}).join('');
  var sections={},sectionOrder=[];
  allItems.forEach(function(item){
    if(!sections[item.section]){sections[item.section]=[];sectionOrder.push(item.section);}
    sections[item.section].push(item);
  });
  var unallocCount=allItems.filter(function(i){return i.tradeId==='unallocated';}).length;

  panel.innerHTML='';
  var wrap=document.createElement('div');
  wrap.style.cssText='display:flex;flex-direction:column;height:100%;overflow:hidden';

  // Toolbar
  var tb=document.createElement('div');
  tb.style.cssText='padding:10px 18px;background:var(--white);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-shrink:0';
  tb.innerHTML='<div style="flex:1"><span style="font-size:14px;font-weight:700;color:var(--text)">Full Schedule</span>'+
    '<span style="font-size:12px;color:var(--text-light);margin-left:10px">'+allItems.length+' items &middot; '+sectionOrder.length+' sections'+
    (unallocCount>0?' &middot; <span style="color:var(--red);font-weight:600">'+unallocCount+' unallocated</span>':'')+
    '</span></div>'+
    '<div style="font-size:11.5px;color:var(--text-light)">Change any dropdown to reassign</div>'+
    '<button class="btn btn-secondary btn-sm" onclick="resetScheduleChanges()">Discard</button>'+
    '<button class="btn btn-primary btn-sm" style="background:var(--green)" onclick="applyScheduleAllocations()">&#10003; Apply Changes</button>'+
    '<button class="btn btn-secondary btn-sm" onclick="alert(\'Exporting annotated schedule...\')">&#8681; Export</button>';
  wrap.appendChild(tb);

  // Spreadsheet
  var sheetWrap=document.createElement('div');
  sheetWrap.style.cssText='flex:1;overflow:auto;background:#E8EAF0';
  var sheet=document.createElement('div');
  sheet.style.cssText='min-width:860px;font-family:Arial,sans-serif;font-size:12px';

  // Column header
  var colHdr=document.createElement('div');
  colHdr.style.cssText='display:grid;grid-template-columns:36px 58px 1fr 46px 50px 210px;position:sticky;top:0;z-index:10;background:#1B3A6B';
  ['','Ref','Description','Qty','Unit','Trade Allocation'].forEach(function(h){
    var d=document.createElement('div');
    d.style.cssText='padding:7px 8px;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.05em;border-right:1px solid rgba(255,255,255,.15)';
    d.textContent=h;
    colHdr.appendChild(d);
  });
  sheet.appendChild(colHdr);

  var rowNum=0;
  sectionOrder.forEach(function(sectionName){
    var items=sections[sectionName];
    // Section row
    var secRow=document.createElement('div');
    secRow.style.cssText='background:#2E4B7A;padding:6px 12px;font-size:11.5px;font-weight:700;color:#fff;display:flex;align-items:center;gap:8px';
    secRow.innerHTML='<span style="opacity:.5;font-size:10px">&#9654;</span>'+esc(sectionName)+
      '<span style="font-size:10px;color:rgba(255,255,255,.45);font-weight:400">'+items.length+' item'+(items.length===1?'':'s')+'</span>';
    sheet.appendChild(secRow);

    items.forEach(function(item,i){
      rowNum++;
      var col=TRADE_COLOURS[item.tradeId]||{bg:'#F0F0F5',border:'#9BA3BF',text:'#4A5272'};
      var bg=i%2===0?'#fff':'#F5F6FA';
      var isUnalloc=item.tradeId==='unallocated';

      var row=document.createElement('div');
      row.style.cssText='display:grid;grid-template-columns:36px 58px 1fr 46px 50px 210px;background:'+bg+';border-bottom:1px solid #E8EAF0';

      // Row num
      var n=document.createElement('div');
      n.style.cssText='padding:6px 4px;text-align:center;font-size:10px;color:#9BA3BF;background:#F5F6FA;border-right:2px solid #E8EAF0';
      n.textContent=rowNum;
      row.appendChild(n);

      // Ref
      var r=document.createElement('div');
      r.style.cssText='padding:6px 8px;text-align:center;font-size:11px;font-weight:700;color:#1B3A6B;border-right:1px solid #E8EAF0';
      r.textContent=item.ref;
      row.appendChild(r);

      // Desc
      var d=document.createElement('div');
      d.style.cssText='padding:6px 8px;font-size:11.5px;color:#1A1A2E;line-height:1.5;border-right:1px solid #E8EAF0';
      d.textContent=item.desc;
      row.appendChild(d);

      // Qty
      var q=document.createElement('div');
      q.style.cssText='padding:6px 4px;text-align:center;font-size:11.5px;border-right:1px solid #E8EAF0';
      q.textContent=item.qty;
      row.appendChild(q);

      // Unit
      var u=document.createElement('div');
      u.style.cssText='padding:6px 4px;text-align:center;font-size:11px;color:#666;border-right:1px solid #E8EAF0';
      u.textContent=item.unit;
      row.appendChild(u);

      // Trade dropdown
      var tc=document.createElement('div');
      tc.style.cssText='padding:4px 6px;display:flex;align-items:center;gap:5px';
      var swatch=document.createElement('div');
      swatch.style.cssText='width:9px;height:9px;border-radius:2px;flex-shrink:0;background:'+col.text;
      tc.appendChild(swatch);
      var sel=document.createElement('select');
      sel.setAttribute('data-item-ref',item.ref);
      sel.style.cssText='flex:1;border:1px solid '+(isUnalloc?'var(--red)':'var(--border)')+';border-radius:3px;padding:3px 5px;font-size:11px;color:'+(isUnalloc?'var(--red)':'var(--text)')+';background:'+(isUnalloc?'var(--red-bg)':'#fff')+';font-family:DM Sans,sans-serif;cursor:pointer';
      sel.innerHTML=tradeOptions;
      sel.value=item.tradeId;
      sel.onchange=function(){
        scheduleMarkChange(this.getAttribute('data-item-ref'),this.value);
        var nc=TRADE_COLOURS[this.value]||{text:'#9BA3BF'};
        this.previousSibling.style.background=nc.text;
        var isU=this.value==='unallocated';
        this.style.borderColor=isU?'var(--red)':'var(--border)';
        this.style.color=isU?'var(--red)':'var(--text)';
        this.style.background=isU?'var(--red-bg)':'#fff';
      };
      tc.appendChild(sel);
      row.appendChild(tc);
      sheet.appendChild(row);
    });
  });

  sheetWrap.appendChild(sheet);
  wrap.appendChild(sheetWrap);

  // Change bar
  var bar=document.createElement('div');
  bar.id='schedule-change-bar';
  var pending=Object.keys(scheduleChanges).length;
  bar.style.cssText='padding:9px 18px;background:var(--amber-bg);border-top:1px solid rgba(196,123,0,.3);flex-shrink:0;display:'+(pending>0?'flex':'none')+';align-items:center;gap:12px';
  bar.innerHTML='<span style="font-size:13px;font-weight:600;color:var(--amber)">'+pending+' change'+(pending===1?'':'s')+' pending</span>'+
    '<span style="font-size:12px;color:var(--amber)">Changes will update trade documents when applied</span>'+
    '<div style="flex:1"></div>'+
    '<button class="btn btn-secondary btn-sm" onclick="resetScheduleChanges()">Discard</button>'+
    '<button class="btn btn-primary btn-sm" style="background:var(--green)" onclick="applyScheduleAllocations()">&#10003; Apply Changes</button>';
  wrap.appendChild(bar);
  panel.appendChild(wrap);
}

function scheduleMarkChange(ref,newTradeId){
  scheduleChanges[ref]=newTradeId;
  var bar=el('schedule-change-bar');
  if(bar){
    var c=Object.keys(scheduleChanges).length;
    bar.style.display='flex';
    bar.querySelector('span').textContent=c+' change'+(c===1?'':'s')+' pending';
  }
}

function resetScheduleChanges(){
  scheduleChanges={};
  renderScheduleView();
}

function applyScheduleAllocations(){
  var count=Object.keys(scheduleChanges).length;
  if(!count){alert('No changes to apply.');return;}
  Object.keys(scheduleChanges).forEach(function(ref){
    var newTradeId=scheduleChanges[ref];
    var foundItem=null;
    splitTrades.forEach(function(t){
      var idx=(t.items||[]).findIndex(function(i){return i.ref===ref;});
      if(idx>-1&&!foundItem){foundItem=t.items.splice(idx,1)[0];t.lineCount=t.items.length;}
    });
    if(foundItem){
      var toTrade=splitTrades.find(function(t){return t.id===newTradeId;});
      if(toTrade){toTrade.items.push(foundItem);toTrade.lineCount=toTrade.items.length;}
    }
  });
  scheduleChanges={};
  renderSplitTradeList();
  if(splitActiveTrade)renderSplitPreview(splitActiveTrade);
  renderScheduleView();
}

// ── SUPPORTING FILES (SPEC & DRAWINGS) ───────────────────
var supportingFiles = { spec: [], dwg: [] };

function specHandleFile(event, type) {
  var files = Array.from(event.target.files);
  files.forEach(function(f){ addSupportingFile(f, type); });
}
function specHandleDrop(event, type) {
  event.preventDefault();
  var dz = el(type+'-drop-zone');
  dz.style.borderColor='var(--border)'; dz.style.background='var(--bg)';
  Array.from(event.dataTransfer.files).forEach(function(f){ addSupportingFile(f, type); });
}
function addSupportingFile(f, type) {
  supportingFiles[type].push(f);
  renderSupportingFilesList();
  updateCheckBtn();
  // Update section 2 header
  var total = supportingFiles.spec.length + supportingFiles.dwg.length;
  el('sec2-status').textContent = total + ' file' + (total===1?'':'s') + ' loaded';
  el('sec2-num').className = 'section-num done';
}
function removeSupportingFile(type, idx) {
  supportingFiles[type].splice(idx, 1);
  renderSupportingFilesList();
  updateCheckBtn();
}
function renderSupportingFilesList() {
  var list = el('supporting-files-list');
  if(!list) return;
  var allFiles = [];
  supportingFiles.spec.forEach(function(f,i){ allFiles.push({f:f,type:'spec',idx:i,label:'Spec'}); });
  supportingFiles.dwg.forEach(function(f,i){ allFiles.push({f:f,type:'dwg',idx:i,label:'Drawing'}); });
  if(!allFiles.length){ list.innerHTML=''; return; }
  list.innerHTML = allFiles.map(function(item){
    var color = item.type==='spec' ? 'var(--teal)' : 'var(--purple)';
    var bg    = item.type==='spec' ? 'var(--teal-bg)' : 'var(--purple-bg)';
    return '<div style="display:flex;align-items:center;gap:7px;padding:5px 8px;background:'+bg+';border-radius:4px;margin-bottom:4px">'+
      '<span style="font-size:10px;font-weight:700;color:'+color+';background:rgba(255,255,255,.6);padding:1px 5px;border-radius:3px;flex-shrink:0">'+item.label+'</span>'+
      '<span style="font-size:11.5px;color:var(--text-mid);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(item.f.name)+'</span>'+
      '<button onclick="removeSupportingFile(\''+item.type+'\','+item.idx+')" style="background:transparent;border:none;color:var(--text-hint);font-size:14px;cursor:pointer;line-height:1;padding:0 2px;flex-shrink:0">&times;</button>'+
    '</div>';
  }).join('');
}
function updateCheckBtn() {
  var btn = el('check-btn');
  if(!btn) return;
  var hasSupporting = supportingFiles.spec.length + supportingFiles.dwg.length > 0;
  btn.disabled = !(splitFile && hasSupporting);
}

// ── CONVERT TO EXCEL ──────────────────────────────────────
async function runConvertToExcel() {
  var btn = el('convert-btn');
  var status = el('convert-status');
  if(!splitFile) return;
  btn.disabled = true;
  btn.innerHTML = '<span style="animation:spin .8s linear infinite;display:inline-block">&#8635;</span> Converting...';
  status.textContent = '';

  try {
    var prepared = await prepareFileContent(splitFile);

    var userContent = buildApiContent(prepared,
      'Extract all line items from this schedule of works and output ONLY raw CSV.\n'+
      'Headers must be: Ref,Section,Description,Qty,Unit\n'+
      'No markdown, no explanation, just the raw CSV starting with the header row.');

    var resp = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:8000,
        system:'You extract schedule of works data. Return ONLY raw CSV with header row: Ref,Section,Description,Qty,Unit — no markdown fences, no explanation.',
        messages:[{role:'user', content:userContent}]
      })
    });

    if(!resp.ok) throw new Error('API error '+resp.status);
    var data = await resp.json();
    var csvText = data.content.filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('').trim();
    csvText = csvText.replace(/^```[a-z]*\n?/,'').replace(/\n?```$/,'').trim();

    var blob = new Blob([csvText], {type:'text/csv'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = splitFile.name.replace(/\.[^.]+$/, '') + '_converted.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);

    btn.disabled = false;
    btn.innerHTML = '<span>&#8645;</span> Convert to Excel';
    status.innerHTML = '<span style="color:var(--green)">&#10003; Downloaded as CSV — open in Excel to save as .xlsx</span>';

  } catch(e) {
    btn.disabled = false;
    btn.innerHTML = '<span>&#8645;</span> Convert to Excel';
    status.innerHTML = '<span style="color:var(--red)">&#10007; '+esc(e.message)+'</span>';
  }
}

// ── COMPLIANCE CHECK ──────────────────────────────────────
var complianceResults = null;

async function runComplianceCheck() {
  var btn = el('check-btn');
  if(!splitFile) return;
  var hasSupporting = supportingFiles.spec.length + supportingFiles.dwg.length > 0;
  if(!hasSupporting) return;

  btn.disabled = true;
  btn.innerHTML = '<span style="animation:spin .8s linear infinite;display:inline-block">&#8635;</span> Checking...';

  // Show compliance tab immediately with a loading state
  el('split-empty').style.display='none';
  el('split-results').style.display='flex';
  switchResultTab('compliance');
  el('compliance-panel').innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-light)">'+
    '<div style="font-size:32px;margin-bottom:12px;animation:spin 1s linear infinite;display:inline-block">&#8635;</div>'+
    '<div style="font-size:14px;font-weight:600;margin-bottom:6px">AI is cross-referencing documents...</div>'+
    '<div style="font-size:12.5px;color:var(--text-hint)">Comparing schedule of works against specification and drawing registers</div>'+
    '</div>';

  // Show result toolbar (minimal) if not already
  el('split-result-title').textContent = 'Compliance Check';
  el('split-result-sub').textContent = 'Cross-referencing schedule against uploaded documents';

  try {
    // Read main SOW file
    var sowPrepared = await prepareFileContent(splitFile);

    // Read supporting files
    var allSupporting = [];
    supportingFiles.spec.forEach(function(f){ allSupporting.push({f:f,label:'Specification'}); });
    supportingFiles.dwg.forEach(function(f){ allSupporting.push({f:f,label:'Drawing Schedule'}); });

    var supportingPrepared = [];
    for(var i=0;i<allSupporting.length;i++){
      var sf = allSupporting[i];
      var prep = await prepareFileContent(sf.f);
      supportingPrepared.push({label:sf.label, name:sf.f.name, prepared:prep});
    }

    // Build message content
    var msgContent = [];
    if(sowPrepared.type === 'pdf') {
      msgContent.push({type:'document', source:{type:'base64', media_type:'application/pdf', data:sowPrepared.content}, title:'Schedule of Works'});
    } else if(sowPrepared.type === 'image') {
      msgContent.push({type:'image', source:{type:'base64', media_type:sowPrepared.mediaType, data:sowPrepared.content}});
      msgContent.push({type:'text', text:'[The above image is the Schedule of Works]'});
    } else {
      msgContent.push({type:'text', text:'=== SCHEDULE OF WORKS ===\n'+sowPrepared.content.substring(0,40000)});
    }

    supportingPrepared.forEach(function(s){
      if(s.prepared.type === 'pdf'){
        msgContent.push({type:'document', source:{type:'base64', media_type:'application/pdf', data:s.prepared.content}, title:s.label+': '+s.name});
      } else {
        msgContent.push({type:'text', text:'\n=== '+s.label.toUpperCase()+': '+s.name+' ===\n'+s.prepared.content.substring(0,20000)});
      }
    });

    msgContent.push({type:'text', text:'Perform a compliance cross-check. Return only a JSON object as specified in the system prompt.'});

    var systemPrompt = 'You are a construction document reviewer for DCK Construction. Cross-check the schedule of works against the provided specification sections and drawing schedules.\n\nReturn ONLY a JSON object with this structure:\n{\n  "summary": {"sowItems": N, "specSections": N, "drawingRefs": N, "missingFromSow": N, "orphanedInSow": N, "crossReferenced": N},\n  "missingFromSow": [\n    {"ref": "spec/drawing ref", "source": "Specification|Drawing Schedule", "sourceFile": "filename", "description": "what is specified or shown but not in the SOW", "severity": "high|medium|low", "recommendation": "suggested action"}\n  ],\n  "orphanedInSow": [\n    {"ref": "SOW item ref", "description": "SOW item description", "issue": "what is missing (no spec clause, no drawing, or both)", "severity": "high|medium|low", "recommendation": "suggested action"}\n  ],\n  "crossReferenced": [\n    {"sowRef": "SOW ref", "specRef": "spec clause or N/A", "drawingRef": "drawing number or N/A", "status": "fully_referenced|partial|none"}\n  ]\n}\n\nSeverity guidance: high = item affects cost, programme or safety; medium = item needs clarification before pricing; low = minor or informational.\n\nReturn ONLY the raw JSON object. No markdown, no explanation.';

    var resp = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:8000,
        system:systemPrompt,
        messages:[{role:'user', content:msgContent}]
      })
    });

    if(!resp.ok) throw new Error('API error '+resp.status);
    var data = await resp.json();
    var raw = data.content.filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('').trim();
    raw = raw.replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim();
    complianceResults = JSON.parse(raw);

    renderCompliancePanel();

    // Update badge
    var total = (complianceResults.missingFromSow||[]).length + (complianceResults.orphanedInSow||[]).length;
    var badge = el('compliance-count-badge');
    if(badge && total > 0){ badge.style.display='inline'; badge.textContent=total; }

  } catch(e) {
    el('compliance-panel').innerHTML = '<div style="padding:32px;background:var(--red-bg);border:1px solid rgba(196,43,28,.2);border-radius:8px;color:var(--red)">'+
      '<strong>Check failed:</strong> '+esc(e.message)+'. Please ensure your documents are readable and try again.</div>';
  }

  btn.disabled = false;
  btn.innerHTML = '&#128269; Check for Gaps &amp; Missing Items';
  updateCheckBtn();
}

function renderCompliancePanel() {
  var panel = el('compliance-panel');
  if(!panel || !complianceResults) return;
  // Hide example state
  var ex = el('compliance-example');
  if(ex) ex.style.display='none';
  var r = complianceResults;
  var s = r.summary || {};
  var missing = r.missingFromSow || [];
  var orphaned = r.orphanedInSow || [];
  var xref = r.crossReferenced || [];

  var sevColor = function(sev){ return sev==='high'?'var(--red)':sev==='medium'?'var(--amber)':'var(--teal)'; };
  var sevBg    = function(sev){ return sev==='high'?'var(--red-bg)':sev==='medium'?'var(--amber-bg)':'var(--teal-bg)'; };

  var html = '';

  // Summary cards
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">';
  var cards = [
    {label:'SOW Items', val:s.sowItems||0, color:'var(--navy)', icon:'&#128196;'},
    {label:'Cross-referenced', val:s.crossReferenced||xref.length, color:'var(--green)', icon:'&#10003;'},
    {label:'Issues Found', val:(s.missingFromSow||missing.length)+(s.orphanedInSow||orphaned.length), color:(missing.length+orphaned.length)>0?'var(--red)':'var(--green)', icon:'&#9888;'},
  ];
  cards.forEach(function(c){
    html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:8px;padding:16px 18px;text-align:center">'+
      '<div style="font-size:22px;color:'+c.color+'">'+c.icon+'</div>'+
      '<div style="font-size:24px;font-weight:700;color:'+c.color+';margin:4px 0">'+c.val+'</div>'+
      '<div style="font-size:11.5px;color:var(--text-light)">'+c.label+'</div>'+
    '</div>';
  });
  html += '</div>';

  // Missing from SOW section
  if(missing.length > 0){
    html += '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:12px">'+
      '<span style="color:var(--red)">&#9660;</span> Items in Spec / Drawings — not found in Schedule of Works <span style="font-size:12px;font-weight:400;color:var(--text-light)">('+missing.length+' items)</span></div>';
    missing.forEach(function(item){
      html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:7px;margin-bottom:10px;overflow:hidden">'+
        '<div style="padding:12px 16px;border-left:4px solid '+sevColor(item.severity)+';display:flex;align-items:flex-start;gap:12px">'+
          '<div style="flex:1">'+
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">'+
              '<span style="font-size:10.5px;font-weight:700;color:'+sevColor(item.severity)+';background:'+sevBg(item.severity)+';padding:2px 7px;border-radius:10px;text-transform:uppercase">'+esc(item.severity)+'</span>'+
              '<span style="font-size:11px;color:var(--text-hint)">'+esc(item.source)+' — '+esc(item.sourceFile)+'</span>'+
              (item.ref?'<span style="font-size:11px;font-weight:700;color:var(--navy);background:var(--navy-lt);padding:1px 6px;border-radius:4px">'+esc(item.ref)+'</span>':'')+''+
            '</div>'+
            '<div style="font-size:13px;color:var(--text);line-height:1.5;margin-bottom:5px">'+esc(item.description)+'</div>'+
            '<div style="font-size:11.5px;color:var(--text-mid);font-style:italic">&#128204; '+esc(item.recommendation)+'</div>'+
          '</div>'+
        '</div>'+
      '</div>';
    });
    html += '<div style="margin-bottom:20px"></div>';
  }

  // Orphaned in SOW
  if(orphaned.length > 0){
    html += '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:12px">'+
      '<span style="color:var(--amber)">&#9650;</span> Items in Schedule of Works — no corresponding Spec or Drawing <span style="font-size:12px;font-weight:400;color:var(--text-light)">('+orphaned.length+' items)</span></div>';
    orphaned.forEach(function(item){
      html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:7px;margin-bottom:10px;overflow:hidden">'+
        '<div style="padding:12px 16px;border-left:4px solid '+sevColor(item.severity)+';display:flex;align-items:flex-start;gap:12px">'+
          '<div style="flex:1">'+
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">'+
              '<span style="font-size:10.5px;font-weight:700;color:'+sevColor(item.severity)+';background:'+sevBg(item.severity)+';padding:2px 7px;border-radius:10px;text-transform:uppercase">'+esc(item.severity)+'</span>'+
              (item.ref?'<span style="font-size:11px;font-weight:700;color:var(--navy);background:var(--navy-lt);padding:1px 6px;border-radius:4px">'+esc(item.ref)+'</span>':'')+''+
            '</div>'+
            '<div style="font-size:13px;color:var(--text);line-height:1.5;margin-bottom:5px">'+esc(item.description)+'</div>'+
            '<div style="font-size:11.5px;color:var(--amber);margin-bottom:4px">&#9888; '+esc(item.issue)+'</div>'+
            '<div style="font-size:11.5px;color:var(--text-mid);font-style:italic">&#128204; '+esc(item.recommendation)+'</div>'+
          '</div>'+
        '</div>'+
      '</div>';
    });
    html += '<div style="margin-bottom:20px"></div>';
  }

  // Cross-reference matrix (collapsed summary)
  if(xref.length > 0){
    var fullRef = xref.filter(function(x){return x.status==='fully_referenced';}).length;
    var partial  = xref.filter(function(x){return x.status==='partial';}).length;
    var none     = xref.filter(function(x){return x.status==='none';}).length;
    html += '<details style="background:var(--white);border:1px solid var(--border);border-radius:8px;overflow:hidden"><summary style="padding:13px 16px;font-size:13px;font-weight:700;color:var(--text);cursor:pointer;list-style:none;display:flex;align-items:center;gap:10px">'+
      '&#128203; Cross-reference Summary ('+xref.length+' items)'+
      '<span style="font-weight:400;font-size:12px;color:var(--green);margin-left:auto">'+fullRef+' full</span>'+
      '<span style="font-weight:400;font-size:12px;color:var(--amber);margin-left:8px">'+partial+' partial</span>'+
      '<span style="font-weight:400;font-size:12px;color:var(--red);margin-left:8px">'+none+' none</span>'+
    '</summary>'+
    '<div style="overflow-x:auto">'+
    '<div style="display:grid;grid-template-columns:70px 1fr 130px 130px 80px;background:var(--navy);font-size:10px;font-weight:700;color:#fff;padding:0">'+
      ['SOW Ref','Description','Spec Ref','Drawing Ref','Status'].map(function(h){return '<div style="padding:7px 10px">'+h+'</div>';}).join('')+
    '</div>'+
    xref.map(function(x,i){
      var statusColor = x.status==='fully_referenced'?'var(--green)':x.status==='partial'?'var(--amber)':'var(--red)';
      var statusLabel = x.status==='fully_referenced'?'✓ Full':x.status==='partial'?'~ Partial':'✗ None';
      return '<div style="display:grid;grid-template-columns:70px 1fr 130px 130px 80px;background:'+(i%2?'#F8F9FC':'#fff')+';border-bottom:1px solid var(--border);font-size:11.5px">'+
        '<div style="padding:6px 10px;font-weight:700;color:var(--navy)">'+esc(x.sowRef||'')+'</div>'+
        '<div style="padding:6px 10px;color:var(--text)">'+esc(x.description||'')+'</div>'+
        '<div style="padding:6px 10px;color:var(--text-mid)">'+esc(x.specRef||'—')+'</div>'+
        '<div style="padding:6px 10px;color:var(--text-mid)">'+esc(x.drawingRef||'—')+'</div>'+
        '<div style="padding:6px 10px;font-weight:700;font-size:10.5px;color:'+statusColor+'">'+statusLabel+'</div>'+
      '</div>';
    }).join('')+
    '</div></details>';
  }

  if(!missing.length && !orphaned.length){
    html += '<div style="background:var(--green-bg);border:1px solid rgba(16,124,16,.2);border-radius:8px;padding:20px 24px;text-align:center">'+
      '<div style="font-size:28px;margin-bottom:8px">&#10003;</div>'+
      '<div style="font-size:14px;font-weight:700;color:var(--green)">No gaps found</div>'+
      '<div style="font-size:12.5px;color:var(--green);margin-top:4px">All items in the schedule of works have corresponding specification or drawing references, and no items appear in the supporting documents without a corresponding SOW entry.</div>'+
    '</div>';
  }

  // Remove any previous live results div, then insert fresh one after the example
  var prev = panel.querySelector('#compliance-live-results');
  if(prev) prev.remove();
  var liveDiv = document.createElement('div');
  liveDiv.id = 'compliance-live-results';
  liveDiv.innerHTML = html;
  panel.appendChild(liveDiv);
}
var revFile = null;
var revisionResults = null;

function revHandleFile(event){
  var f = event.target.files[0];
  if(f) setRevFile(f);
}
function revHandleDrop(event){
  event.preventDefault();
  var dz = el('rev-drop-zone');
  dz.style.borderColor='var(--border)'; dz.style.background='var(--bg)';
  var f = event.dataTransfer.files[0];
  if(f) setRevFile(f);
}
function setRevFile(f){
  revFile = f;
  var ext = f.name.split('.').pop().toLowerCase();
  var kb = Math.round(f.size/1024);
  el('rev-file-name').textContent = f.name;
  el('rev-file-meta').textContent = (kb>1024?(kb/1024).toFixed(1)+' MB':kb+' KB')+' · '+ext.toUpperCase();
  el('rev-file-pill').style.display = 'block';
  el('rev-upload-area').style.display = 'none';
  el('sec5-num').className = 'section-num done';
  el('sec5-status').textContent = f.name.length>18 ? f.name.substring(0,16)+'…' : f.name;
  updateRevBtn();
}
function clearRevFile(){
  revFile = null;
  el('rev-file-pill').style.display = 'none';
  el('rev-upload-area').style.display = 'block';
  el('sec5-num').className = 'section-num optional';
  el('sec5-status').textContent = 'optional';
  updateRevBtn();
}
function updateRevBtn(){
  var btn = el('rev-compare-btn');
  if(!btn) return;
  // Can compare if we have a new file AND either existing splitTrades or an original file
  btn.disabled = !(revFile && splitTrades.length > 0);
}

async function runRevisionCompare(){
  if(!revFile){ alert('Please upload a revised schedule first.'); return; }
  if(!splitTrades.length){ alert('Run the AI Trade Split first so there is a current schedule to compare against.'); return; }

  var btn = el('rev-compare-btn');
  btn.disabled = true;
  btn.innerHTML = '<span style="animation:spin .8s linear infinite;display:inline-block">&#8635;</span> Comparing...';

  // Switch to revision tab and show loading state
  el('split-empty').style.display = 'none';
  el('split-results').style.display = 'flex';
  switchResultTab('revision');
  // Hide example, show loading state
  var revEx = el('revision-example');
  if(revEx) revEx.style.display = 'none';
  var prevLive = el('revision-panel').querySelector('#revision-live-results');
  if(prevLive) prevLive.remove();
  var loadDiv = document.createElement('div');
  loadDiv.id = 'revision-live-results';
  loadDiv.innerHTML =
    '<div style="padding:40px;text-align:center;color:var(--text-light)">'+
    '<div style="font-size:32px;margin-bottom:12px;animation:spin 1s linear infinite;display:inline-block">&#8635;</div>'+
    '<div style="font-size:14px;font-weight:600;margin-bottom:6px">AI is comparing revisions...</div>'+
    '<div style="font-size:12.5px;color:var(--text-hint)">Identifying new, amended and deleted items against the current schedule</div>'+
    '</div>';
  el('revision-panel').appendChild(loadDiv);

  try {
    // Serialise current schedule as structured text for the AI
    var currentScheduleText = 'CURRENT SCHEDULE OF WORKS (already parsed):\n\n';
    splitTrades.forEach(function(t){
      if(!t.items || !t.items.length) return;
      currentScheduleText += '=== '+t.label+' ('+t.id+') ===\n';
      t.items.forEach(function(item){
        currentScheduleText += 'REF:'+item.ref+' | SECTION:'+item.section+' | QTY:'+item.qty+' '+item.unit+' | DESC:'+item.desc+'\n';
      });
      currentScheduleText += '\n';
    });

    // Read new file
    var newPrepared = await prepareFileContent(revFile);

    // Build message content
    var msgContent = [];
    msgContent.push({type:'text', text: currentScheduleText});
    if(newPrepared.type === 'pdf'){
      msgContent.push({type:'document', source:{type:'base64', media_type:'application/pdf', data:newPrepared.content}, title:'Revised Schedule'});
    } else if(newPrepared.type === 'image'){
      msgContent.push({type:'image', source:{type:'base64', media_type:newPrepared.mediaType, data:newPrepared.content}});
    } else {
      msgContent.push({type:'text', text:'REVISED SCHEDULE (new version):\n\n'+newPrepared.content.substring(0,60000)});
    }
    msgContent.push({type:'text', text:'Compare the current schedule against the revised schedule. Return only the JSON diff object as specified.'});

    var systemPrompt =
      'You are a construction document analyst. Compare a current schedule of works against a revised version issued without tracked changes.\n\n'+
      'Return ONLY a JSON object:\n'+
      '{\n'+
      '  "revisionRef": "string — revision number or date if identifiable from the document, else null",\n'+
      '  "summary": {"total": N, "new": N, "amended": N, "deleted": N, "unchanged": N},\n'+
      '  "changes": [\n'+
      '    {\n'+
      '      "changeType": "new|amended|deleted|unchanged",\n'+
      '      "ref": "item ref",\n'+
      '      "tradeId": "trade id from current schedule, or best guess for new items",\n'+
      '      "tradeLabel": "trade label",\n'+
      '      "section": "section heading",\n'+
      '      "currentDesc": "current description or null if new",\n'+
      '      "currentQty": number or null,\n'+
      '      "currentUnit": "unit or null",\n'+
      '      "revisedDesc": "revised description or null if deleted",\n'+
      '      "revisedQty": number or null,\n'+
      '      "revisedUnit": "unit or null",\n'+
      '      "changeNotes": "brief plain-English summary of what changed, e.g. Qty increased 6nr to 9nr, or Description extended to include fire rating"\n'+
      '    }\n'+
      '  ]\n'+
      '}\n\n'+
      'Rules:\n'+
      '- Include ALL items — new, amended, deleted AND unchanged.\n'+
      '- For "amended": populate both current* and revised* fields.\n'+
      '- For "new": currentDesc/currentQty/currentUnit = null.\n'+
      '- For "deleted": revisedDesc/revisedQty/revisedUnit = null.\n'+
      '- changeNotes should be concise (max 15 words) and highlight the key difference.\n'+
      '- Return ONLY the raw JSON. No markdown, no explanation.';

    var resp = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:8000,
        system: systemPrompt,
        messages:[{role:'user', content:msgContent}]
      })
    });

    if(!resp.ok) throw new Error('API error '+resp.status);
    var data = await resp.json();
    var raw = data.content.filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('').trim();
    raw = raw.replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim();
    revisionResults = JSON.parse(raw);

    // Auto-update splitTrades with the revised items
    applyRevisionToTrades(revisionResults);

    renderRevisionPanel();

    // Update badge
    var changed = (revisionResults.summary.new||0) + (revisionResults.summary.amended||0) + (revisionResults.summary.deleted||0);
    var badge = el('revision-count-badge');
    if(badge && changed > 0){ badge.style.display='inline'; badge.textContent=changed+' change'+(changed===1?'':'s'); }

  } catch(e) {
    var errPrev = el('revision-panel').querySelector('#revision-live-results');
    if(errPrev) errPrev.remove();
    var errDiv2 = document.createElement('div');
    errDiv2.id = 'revision-live-results';
    errDiv2.innerHTML = '<div style="padding:32px;background:var(--red-bg);border:1px solid rgba(196,43,28,.2);border-radius:8px;color:var(--red)"><strong>Comparison failed:</strong> '+esc(e.message)+'</div>';
    el('revision-panel').appendChild(errDiv2);
  }

  btn.disabled = false;
  btn.innerHTML = '&#128260; Compare &amp; Update Trade Documents';
  updateRevBtn();
}

function applyRevisionToTrades(results){
  if(!results || !results.changes) return;
  results.changes.forEach(function(change){
    if(change.changeType === 'unchanged') return;

    if(change.changeType === 'deleted'){
      // Remove item from its trade
      splitTrades.forEach(function(t){
        var idx = t.items.findIndex(function(i){return i.ref===change.ref;});
        if(idx > -1){ t.items.splice(idx,1); t.lineCount=t.items.length; }
      });
      return;
    }

    if(change.changeType === 'amended'){
      // Update the item in place
      var found = false;
      splitTrades.forEach(function(t){
        var item = t.items.find(function(i){return i.ref===change.ref;});
        if(item){
          item.desc = change.revisedDesc || item.desc;
          item.qty  = change.revisedQty  != null ? change.revisedQty : item.qty;
          item.unit = change.revisedUnit || item.unit;
          item.revised = true;
          item.changeNotes = change.changeNotes;
          found = true;
        }
      });
      return;
    }

    if(change.changeType === 'new'){
      // Add to the matching trade, or unallocated
      var targetTrade = splitTrades.find(function(t){return t.id===change.tradeId;});
      if(!targetTrade) targetTrade = splitTrades.find(function(t){return t.id==='unallocated';});
      if(!targetTrade){
        // Create a minimal unallocated bucket
        targetTrade = {id:'unallocated',label:'To Be Allocated',nbs:[],items:[],lineCount:0,unallocated:true};
        splitTrades.push(targetTrade);
      }
      targetTrade.items.push({
        ref: change.ref,
        desc: change.revisedDesc || '',
        qty: change.revisedQty || 1,
        unit: change.revisedUnit || 'item',
        section: change.section || targetTrade.label,
        isNew: true,
        changeNotes: change.changeNotes
      });
      targetTrade.lineCount = targetTrade.items.length;
    }
  });

  // Refresh trade list if results are showing
  if(el('split-results').style.display !== 'none'){
    renderSplitTradeList();
    if(splitActiveTrade) renderSplitPreview(splitActiveTrade);
  }
}

function renderRevisionPanel(){
  var panel = el('revision-panel');
  if(!panel || !revisionResults) return;
  // Hide example
  var ex = el('revision-example');
  if(ex) ex.style.display = 'none';
  var r = revisionResults;
  var s = r.summary || {};
  var changes = r.changes || [];

  var newItems      = changes.filter(function(c){return c.changeType==='new';});
  var amendedItems  = changes.filter(function(c){return c.changeType==='amended';});
  var deletedItems  = changes.filter(function(c){return c.changeType==='deleted';});
  var unchangedItems= changes.filter(function(c){return c.changeType==='unchanged';});

  var html = '';

  // Header banner
  html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:8px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:flex-start;gap:16px">'+
    '<div style="font-size:28px">&#128260;</div>'+
    '<div style="flex:1">'+
      '<div style="font-size:15px;font-weight:700;color:var(--text)">Revision Comparison'+(r.revisionRef?' — <span style="color:var(--purple)">'+esc(r.revisionRef)+'</span>':'')+'</div>'+
      '<div style="font-size:12.5px;color:var(--text-light);margin-top:3px">Trade documents have been automatically updated. Review the changes below.</div>'+
    '</div>'+
    '<button class="btn btn-secondary btn-sm" onclick="downloadRevisionReport()">&#8681; Export Report</button>'+
  '</div>';

  // Summary cards
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px">';
  [
    {label:'New Items',    count:newItems.length,      color:'var(--green)',  bg:'var(--green-bg)',  icon:'&#43;'},
    {label:'Amended',      count:amendedItems.length,  color:'var(--amber)',  bg:'var(--amber-bg)',  icon:'&#9998;'},
    {label:'Deleted',      count:deletedItems.length,  color:'var(--red)',    bg:'var(--red-bg)',    icon:'&#8722;'},
    {label:'Unchanged',    count:unchangedItems.length,color:'var(--text-hint)',bg:'var(--bg)',      icon:'&#8776;'},
  ].forEach(function(c){
    html += '<div style="background:'+c.bg+';border:1px solid '+c.color+'33;border-radius:8px;padding:13px 14px;text-align:center">'+
      '<div style="font-size:20px;font-weight:800;color:'+c.color+'">'+c.icon+'</div>'+
      '<div style="font-size:22px;font-weight:700;color:'+c.color+';margin:2px 0">'+c.count+'</div>'+
      '<div style="font-size:11px;color:'+c.color+';font-weight:600">'+c.label+'</div>'+
    '</div>';
  });
  html += '</div>';

  // Render each change group
  function renderGroup(items, type, label, borderColor, bgColor, iconHtml){
    if(!items.length) return '';
    var out = '<div style="margin-bottom:22px">';
    out += '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;display:flex;align-items:center;gap:8px">'+
      '<span style="background:'+bgColor+';color:'+borderColor+';border:1px solid '+borderColor+'44;padding:2px 9px;border-radius:10px;font-size:11px">'+iconHtml+'</span>'+
      label+
      '<span style="font-size:12px;font-weight:400;color:var(--text-light)">'+items.length+' item'+(items.length===1?'':'s')+'</span>'+
    '</div>';

    items.forEach(function(change){
      var tradeColor = TRADE_COLOURS[change.tradeId] || {text:'#9BA3BF',bg:'#F0F0F5'};
      out += '<div style="background:var(--white);border:1px solid var(--border);border-left:4px solid '+borderColor+';border-radius:6px;margin-bottom:8px;overflow:hidden">';

      // Item header row
      out += '<div style="padding:10px 14px;display:flex;align-items:flex-start;gap:10px;background:'+bgColor+'22">'+
        '<span style="font-size:11px;font-weight:700;color:var(--navy);background:#fff;border:1px solid var(--border);padding:2px 7px;border-radius:4px;flex-shrink:0;margin-top:1px">'+esc(change.ref||'—')+'</span>'+
        '<div style="flex:1">'+
          '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'+
            '<span style="font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:10px;background:'+tradeColor.bg+';color:'+tradeColor.text+';border:1px solid '+tradeColor.text+'33">'+esc(change.tradeLabel||change.tradeId||'Unallocated')+'</span>'+
            (change.section ? '<span style="font-size:10.5px;color:var(--text-hint)">'+esc(change.section)+'</span>' : '')+
          '</div>'+
          (change.changeNotes ? '<div style="font-size:11.5px;color:'+borderColor+';margin-top:5px;font-weight:600">'+esc(change.changeNotes)+'</div>' : '')+
        '</div>'+
      '</div>';

      // Diff content
      if(type === 'new'){
        out += '<div style="padding:10px 14px">'+
          '<div style="font-size:12.5px;color:var(--text);line-height:1.5">'+esc(change.revisedDesc||'')+'</div>'+
          (change.revisedQty != null ? '<div style="font-size:11.5px;color:var(--text-mid);margin-top:4px">Qty: <strong>'+change.revisedQty+' '+esc(change.revisedUnit||'')+'</strong></div>' : '')+
        '</div>';
      } else if(type === 'deleted'){
        out += '<div style="padding:10px 14px">'+
          '<div style="font-size:12.5px;color:var(--text-hint);text-decoration:line-through;line-height:1.5">'+esc(change.currentDesc||'')+'</div>'+
          (change.currentQty != null ? '<div style="font-size:11.5px;color:var(--text-hint);margin-top:4px;text-decoration:line-through">Qty: '+change.currentQty+' '+esc(change.currentUnit||'')+'</div>' : '')+
        '</div>';
      } else if(type === 'amended'){
        // Side-by-side before / after
        out += '<div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--border)">';
        // Before
        out += '<div style="padding:10px 14px;border-right:1px solid var(--border);background:#FFF8F8">'+
          '<div style="font-size:10px;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Before</div>'+
          '<div style="font-size:12px;color:var(--text);line-height:1.5">'+esc(change.currentDesc||'')+'</div>'+
          (change.currentQty != null ? '<div style="font-size:11px;color:var(--text-mid);margin-top:4px">'+change.currentQty+' '+esc(change.currentUnit||'')+'</div>' : '')+
        '</div>';
        // After
        out += '<div style="padding:10px 14px;background:#F5FBF5">'+
          '<div style="font-size:10px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">After</div>'+
          '<div style="font-size:12px;color:var(--text);line-height:1.5">'+esc(change.revisedDesc||'')+'</div>'+
          (change.revisedQty != null ? '<div style="font-size:11px;color:var(--text-mid);margin-top:4px">'+change.revisedQty+' '+esc(change.revisedUnit||'')+'</div>' : '')+
        '</div>';
        out += '</div>';
      }

      out += '</div>';
    });
    out += '</div>';
    return out;
  }

  if(newItems.length)     html += renderGroup(newItems,     'new',      'New Items',     'var(--green)', 'var(--green-bg)', '+ New');
  if(amendedItems.length) html += renderGroup(amendedItems, 'amended',  'Amended Items', 'var(--amber)', 'var(--amber-bg)', '&#9998; Amended');
  if(deletedItems.length) html += renderGroup(deletedItems, 'deleted',  'Deleted Items', 'var(--red)',   'var(--red-bg)',   '&#8722; Deleted');

  // Unchanged — collapsible summary
  if(unchangedItems.length){
    html += '<details style="background:var(--white);border:1px solid var(--border);border-radius:7px;overflow:hidden">'+
      '<summary style="padding:12px 16px;font-size:13px;font-weight:600;color:var(--text-hint);cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px">'+
        '&#8776; '+unchangedItems.length+' Unchanged Items'+
        '<span style="font-size:11.5px;font-weight:400;color:var(--text-hint);margin-left:auto">No changes detected</span>'+
      '</summary>'+
      '<div style="border-top:1px solid var(--border)">'+
      unchangedItems.map(function(c,i){
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;background:'+(i%2?'#F8F9FC':'#fff')+';border-bottom:1px solid #F0F2F6;font-size:12px">'+
          '<span style="font-weight:700;color:var(--navy);min-width:50px">'+esc(c.ref||'')+'</span>'+
          '<span style="color:var(--text-mid);flex:1">'+esc(c.currentDesc||c.revisedDesc||'')+'</span>'+
          '<span style="color:var(--text-hint);font-size:11px">'+esc(c.tradeLabel||'')+'</span>'+
        '</div>';
      }).join('')+
      '</div></details>';
  }

  if(!newItems.length && !amendedItems.length && !deletedItems.length){
    html += '<div style="background:var(--green-bg);border:1px solid rgba(16,124,16,.2);border-radius:8px;padding:24px;text-align:center">'+
      '<div style="font-size:28px;margin-bottom:8px">&#10003;</div>'+
      '<div style="font-size:14px;font-weight:700;color:var(--green)">No changes found</div>'+
      '<div style="font-size:12.5px;color:var(--green);margin-top:4px">The revised schedule appears identical to the current version.</div>'+
    '</div>';
  }

  var prev = panel.querySelector('#revision-live-results');
  if(prev) prev.remove();
  var liveDiv = document.createElement('div');
  liveDiv.id = 'revision-live-results';
  liveDiv.innerHTML = html;
  panel.appendChild(liveDiv);
}

function downloadRevisionReport(){
  if(!revisionResults) return;
  var r = revisionResults;
  var changes = r.changes || [];
  var lines = ['Ref,Trade,Section,Change Type,Change Notes,Current Desc,Current Qty,Current Unit,Revised Desc,Revised Qty,Revised Unit'];
  changes.forEach(function(c){
    if(c.changeType === 'unchanged') return;
    lines.push([
      c.ref||'',
      c.tradeLabel||c.tradeId||'',
      c.section||'',
      c.changeType||'',
      (c.changeNotes||'').replace(/,/g,' '),
      (c.currentDesc||'').replace(/,/g,' ').replace(/\n/g,' '),
      c.currentQty!=null?c.currentQty:'',
      c.currentUnit||'',
      (c.revisedDesc||'').replace(/,/g,' ').replace(/\n/g,' '),
      c.revisedQty!=null?c.revisedQty:'',
      c.revisedUnit||''
    ].join(','));
  });
  var blob = new Blob([lines.join('\n')], {type:'text/csv'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href=url; a.download='Revision_Changes'+(r.revisionRef?'_'+r.revisionRef:'')+'.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


var _origResetSplit = resetSplit;
resetSplit = function(){
  _origResetSplit();
  // Clear supporting files
  supportingFiles = {spec:[], dwg:[]};
  complianceResults = null;
  renderSupportingFilesList();
  updateCheckBtn();
  // Clear compliance badge and panel — restore example state
  var badge = el('compliance-count-badge');
  if(badge){ badge.style.display='none'; }
  var ex = el('compliance-example');
  if(ex) ex.style.display='block';
  el('sec2-status').textContent = 'optional';
  el('sec2-num').className = 'section-num optional';
  // Clear revision state — restore example
  revFile = null; revisionResults = null;
  var rp = el('rev-file-pill'); if(rp) rp.style.display='none';
  var ru = el('rev-upload-area'); if(ru) ru.style.display='block';
  el('sec5-num').className = 'section-num optional';
  el('sec5-status').textContent = 'optional';
  var rb = el('revision-count-badge'); if(rb) rb.style.display='none';
  var revLive = document.getElementById('revision-live-results');
  if(revLive) revLive.remove();
  var revEx2 = el('revision-example');
  if(revEx2) revEx2.style.display = 'block';
  var revbtn = el('rev-compare-btn'); if(revbtn) revbtn.disabled=true;
};

function confirmAllocation(ref){
  var tradeId=document.getElementById('allocate-trade-select').value;
  var note=document.getElementById('allocate-note').value;
  var unalloc=splitTrades.find(function(t){return t.id==='unallocated';});
  var target=splitTrades.find(function(t){return t.id===tradeId;});
  if(!unalloc||!target)return;
  var idx=unalloc.items.findIndex(function(i){return i.ref===ref;});
  if(idx>-1){
    var item=unalloc.items.splice(idx,1)[0];
    if(note)item.note=note;
    target.items.push(item);
    target.lineCount=target.items.length;
    unalloc.lineCount=unalloc.items.length;
  }
  document.getElementById('allocate-modal').remove();
  renderSplitTradeList();
  if(splitActiveTrade)renderSplitPreview(splitActiveTrade);
  renderScheduleView();
}
