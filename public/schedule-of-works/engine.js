
var splitFile=null,splitActiveTrade=null,splitTrades=[],pricingDocuments=[];
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
var splitTrades = [];   // catalogue trades for Full Schedule and shared items
var pricingDocuments = [];   // Trade Documents tab, grouped by overarching name
var sowProjectJobId = '';
var sowSplitProcessing = false;
var sowFoundFiles = [];
var sowSelectedFileIndex = -1;
var sowFoundFilesLoading = false;
var sowSplitValidationMsg = '';
var sowSplitStepTimers = null;
var sowSplitLoadGeneration = 0;
var sowFullSchedule = [];
var sowScheduleSheets = [];
var sowActiveScheduleSheet = '';
var sowScheduleSheetScrollLeft = 0;
var sowScheduleSheetScrollLocked = false;
var sowSplitResponse = null;
var SHARED_ITEMS = [];
var sowSharedItemRemoving = false;

function updateSowEmsSectionStatus(){
  if(splitFile) return;
  var statusEl = el('sec1-status');
  var numEl = el('sec1-num');
  if(!statusEl || !numEl) return;
  var selected = sowSelectedFileIndex >= 0 ? sowFoundFiles[sowSelectedFileIndex] : null;
  if(selected && selected.file_name){
    var name = selected.file_name;
    statusEl.textContent = name.length > 18 ? name.substring(0,16)+'…' : name;
    numEl.className = 'section-num done';
  } else if(!sowFoundFilesLoading){
    statusEl.textContent = '';
    if(sowFoundFiles.length) numEl.className = 'section-num done';
  }
}

function renderSowFoundFilesList(){
  var container = el('sec1-ems-files');
  var emptyEl = el('sec1-ems-empty');
  var notice = el('sec1-ems-notice');
  if(!container) return;

  if(splitFile){
    if(notice) notice.style.display = 'none';
    return;
  }

  if(notice) notice.style.display = 'flex';

  if(sowFoundFilesLoading){
    container.innerHTML = '';
    container.style.display = 'none';
    if(emptyEl){
      emptyEl.style.display = 'block';
      emptyEl.textContent = 'Loading schedules from EMS…';
    }
    return;
  }

  if(!sowFoundFiles.length){
    container.innerHTML = '';
    container.style.display = 'none';
    if(emptyEl){
      emptyEl.style.display = 'block';
      emptyEl.textContent = 'No schedule loaded yet — upload below or open from EMS';
    }
    updateSowEmsSectionStatus();
    return;
  }

  if(emptyEl) emptyEl.style.display = 'none';
  container.style.display = 'flex';

  container.innerHTML = sowFoundFiles.map(function(f,i){
    var checked = i === sowSelectedFileIndex ? ' checked' : '';
    return '<label class="sow-ems-file-item">'+
      '<input type="checkbox" value="'+i+'"'+checked+' onchange="toggleSowFoundFile('+i+', this.checked)">'+
      '<span class="sow-ems-file-name" title="'+esc(f.file_name)+'">'+esc(f.file_name)+'</span>'+
    '</label>';
  }).join('');

  updateSowEmsSectionStatus();
}

function toggleSowFoundFile(index, checked){
  clearSplitValidation();
  if(checked){
    sowSelectedFileIndex = index;
  } else if(sowSelectedFileIndex === index){
    sowSelectedFileIndex = -1;
  }
  renderSowFoundFilesList();
  if(splitFile) return;
  if(checked && sowSelectedFileIndex === index) requestSowSheets();
  else clearSowSheetPicker();
}

window.setSowFoundFiles = function(files){
  sowFoundFiles = Array.isArray(files) ? files.filter(function(f){ return f && f.file_name; }) : [];
  sowSelectedFileIndex = -1;
  sowFoundFilesLoading = false;
  renderSowFoundFilesList();
  if(!splitFile) clearSowSheetPicker();
};

window.setSowFoundFilesLoading = function(loading){
  sowFoundFilesLoading = Boolean(loading);
  renderSowFoundFilesList();
};

var SOW_TRADE_SPLIT_CONFIG = {
  method: {
    label: 'Identify trades by',
    default: 'ai',
    options: [
      { value: 'ai', label: 'AI — NBS codes + section headings (recommended)' },
      { value: 'nbs', label: 'NBS codes only' },
      { value: 'headings', label: 'Section headings only' }
    ]
  },
  inclPrelims: {
    label: 'Include preliminaries section',
    default: true
  },
  inclBwic: {
    label: "Include builder's work items",
    default: true
  }
};

function normalizeSowTradeSplitMethod(value){
  var v = String(value || '').trim().toLowerCase();
  if(v === 'nbs' || v === 'headings' || v === 'ai') return v;
  return SOW_TRADE_SPLIT_CONFIG.method.default;
}

function getSowTradeSplitOptions(){
  var methodEl = el('split-method');
  var prelimsEl = el('split-inclPrelims');
  var bwicEl = el('split-inclBwic');
  return {
    method: normalizeSowTradeSplitMethod(methodEl ? methodEl.value : SOW_TRADE_SPLIT_CONFIG.method.default),
    inclPrelims: prelimsEl ? prelimsEl.checked : SOW_TRADE_SPLIT_CONFIG.inclPrelims.default,
    inclBwic: bwicEl ? bwicEl.checked : SOW_TRADE_SPLIT_CONFIG.inclBwic.default
  };
}

function setSowTradeSplitOptions(opts){
  if(!opts) return;
  var methodEl = el('split-method');
  if(methodEl) methodEl.value = normalizeSowTradeSplitMethod(opts.method);
  var prelimsEl = el('split-inclPrelims');
  if(prelimsEl && typeof opts.inclPrelims === 'boolean') prelimsEl.checked = opts.inclPrelims;
  var bwicEl = el('split-inclBwic');
  if(bwicEl && typeof opts.inclBwic === 'boolean') bwicEl.checked = opts.inclBwic;
}

function renderSowTradeSplitForm(){
  var container = el('sow-trade-split-form');
  if(!container) return;
  var cfg = SOW_TRADE_SPLIT_CONFIG;
  var methodOpts = cfg.method.options.map(function(o){
    return '<option value="'+esc(o.value)+'">'+esc(o.label)+'</option>';
  }).join('');
  container.innerHTML =
    '<div class="field">'+
      '<label for="split-method">'+esc(cfg.method.label)+'</label>'+
      '<select id="split-method" name="method">'+methodOpts+'</select>'+
    '</div>'+
    '<label class="sow-trade-split-check" for="split-inclPrelims">'+
      '<input type="checkbox" id="split-inclPrelims" name="inclPrelims"'+(cfg.inclPrelims.default ? ' checked' : '')+'>'+
      esc(cfg.inclPrelims.label)+
    '</label>'+
    '<label class="sow-trade-split-check" for="split-inclBwic">'+
      '<input type="checkbox" id="split-inclBwic" name="inclBwic"'+(cfg.inclBwic.default ? ' checked' : '')+'>'+
      esc(cfg.inclBwic.label)+
    '</label>';
  var methodEl = el('split-method');
  if(methodEl) methodEl.value = cfg.method.default;
}

window.getSowTradeSplitOptions = getSowTradeSplitOptions;
window.setSowTradeSplitOptions = setSowTradeSplitOptions;

function updateSplitRunBtnState(){
  var btn = el('split-run-btn');
  if(!btn) return;
  btn.disabled = sowSplitProcessing;
  if(sowSplitProcessing){
    btn.textContent = 'Running AI Trade Split…';
  } else {
    btn.innerHTML = '&#10022; Run AI Trade Split';
  }
  var hint = el('split-run-hint');
  if(hint){
    if(sowSplitProcessing){
      hint.textContent = 'This may take around 2 minutes — please keep this page open.';
      hint.style.color = 'var(--text-hint)';
    } else if(sowSplitValidationMsg){
      hint.textContent = sowSplitValidationMsg;
      hint.style.color = 'var(--red)';
    } else {
      hint.textContent = sowProjectJobId
        ? 'AI reads the schedule and identifies trade packages'
        : 'No project selected — add one when you run, or pick one in the header';
      hint.style.color = '';
    }
  }
}

function removeComplianceTransient(){
  ['compliance-live-results','compliance-empty-state','compliance-loading'].forEach(function(id){
    var node = el(id);
    if(node) node.remove();
  });
}

function sowTabEmptyStateHtml(icon, title, message){
  return '<div style="background:var(--white);border:1px solid var(--border);border-radius:8px;padding:40px 28px;text-align:center;color:var(--text-light)">'+
    '<div style="font-size:36px;opacity:.25;margin-bottom:12px">'+icon+'</div>'+
    '<div style="font-size:15px;font-weight:700;color:var(--text-mid);margin-bottom:6px">'+esc(title)+'</div>'+
    '<div style="font-size:13px;line-height:1.55;max-width:420px;margin:0 auto">'+message+'</div>'+
  '</div>';
}

function clearComplianceResults(){
  complianceResults = null;
  var badge = el('compliance-count-badge');
  if(badge) badge.style.display = 'none';
  renderComplianceView();
}

function resetSowSection1UploadUi(){
  splitFile = null;
  if(el('split-file-pill')) el('split-file-pill').style.display = 'none';
  if(el('sow-upload-area')) el('sow-upload-area').style.display = 'block';
  if(el('sec1-ems-notice')) el('sec1-ems-notice').style.display = 'flex';
  var convertSection = el('convert-section');
  if(convertSection) convertSection.style.display = 'none';
  var convertStatus = el('convert-status');
  if(convertStatus) convertStatus.textContent = '';
  if(el('sec1-status')) el('sec1-status').textContent = '';
  if(el('sec1-num')) el('sec1-num').className = 'section-num done';
  clearSowSheetPicker();
}

function resetSowModuleForProjectSwitch(){
  window.cancelLoadSavedSowSplit();

  resetSowSection1UploadUi();

  supportingFiles = { spec: [], dwg: [] };
  renderSupportingFilesList();
  clearSowSupportingDocuments();
  updateSec2Status();
  updateCheckBtn();

  if(typeof clearRevFile === 'function') clearRevFile();

  clearSplitResultsOnly();
  clearComplianceResults();

  var tradeList = el('split-trade-list');
  if(tradeList) tradeList.innerHTML = '';
  var previewPanel = el('split-preview-panel');
  if(previewPanel){
    previewPanel.innerHTML =
      '<div style="padding:40px;text-align:center;color:var(--text-light)">No trade documents yet. Run AI Trade Split for this project.</div>';
  }

  if(typeof clearWbTemplate === 'function') clearWbTemplate();

  scheduleChanges = {};
  scheduleOverarchingChanges = {};
  scheduleApplying = false;
  updateScheduleChangeUi();

  sowSplitValidationMsg = '';
  clearSplitValidation();

  renderScheduleView();
  renderSharedItems();
  switchResultTab('schedule');
}

var sowBoundProjectJobId = '';

window.resetSowModuleForProjectSwitch = resetSowModuleForProjectSwitch;

window.setSowProjectContext = function(ctx, options){
  var newJobId = (ctx && ctx.jobId) ? String(ctx.jobId).trim() : '';
  var preserveWork = Boolean(options && options.preserveWork);
  if(newJobId !== sowBoundProjectJobId){
    if(!preserveWork) resetSowModuleForProjectSwitch();
    sowBoundProjectJobId = newJobId;
  }
  sowProjectJobId = newJobId;
  var nameEl = el('split-proj-name');
  var clientEl = el('split-client');
  if(nameEl){
    nameEl.value = (ctx && ctx.projectName) ? String(ctx.projectName) : '';
  }
  if(clientEl){
    clientEl.value = (ctx && ctx.clientName) ? String(ctx.clientName) : '';
  }
  updateSplitRunBtnState();
};

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
  clearSplitValidation();
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
  expandSection('sec1');

  updateCheckBtn();
  requestSowSheets();
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
  renderSowFoundFilesList();
  clearSowSheetPicker();
}

function showSplitValidation(msg){
  sowSplitValidationMsg = msg || '';
  expandSection('sec1');
  updateSplitRunBtnState();
}

function clearSplitValidation(){
  sowSplitValidationMsg = '';
  updateSplitRunBtnState();
}

function getSowSplitSource(){
  if(splitFile){
    return { type: 'upload', file: splitFile, label: splitFile.name };
  }
  if(sowSelectedFileIndex >= 0){
    var selected = sowFoundFiles[sowSelectedFileIndex];
    if(selected && selected.file_path){
      return { type: 'existing', file_path: selected.file_path, label: selected.file_name };
    }
  }
  return null;
}

var sowSheetOptions = [];
var sowSelectedSheetIndexes = {};
var sowSheetsLoading = false;
var sowSheetsLoaded = false;
var sowSheetsError = '';
var sowSheetsRequestId = 0;
var sowSheetsAbort = null;
var sowSheetsMenuOpen = false;

function selectedSowSheetIndexes(){
  return Object.keys(sowSelectedSheetIndexes)
    .map(function(key){ return Number(key); })
    .filter(function(index){ return sowSelectedSheetIndexes[index]; })
    .sort(function(a, b){ return a - b; });
}

function clearSowSheetPicker(){
  sowSheetsRequestId += 1;
  if(sowSheetsAbort){
    sowSheetsAbort.abort();
    sowSheetsAbort = null;
  }
  sowSheetOptions = [];
  sowSelectedSheetIndexes = {};
  sowSheetsLoading = false;
  sowSheetsLoaded = false;
  sowSheetsError = '';
  sowSheetsMenuOpen = false;
  renderSowSheetPicker();
}

function sowSheetsReadyForRun(){
  if(sowSheetsLoading){
    showSplitValidation('Sheets are still loading. Please wait.');
    return false;
  }
  if(sowSheetsError){
    showSplitValidation(sowSheetsError);
    return false;
  }
  if(!sowSheetOptions.length){
    showSplitValidation('No sheets were found for this file.');
    return false;
  }
  if(!selectedSowSheetIndexes().length){
    showSplitValidation('Select at least one sheet.');
    return false;
  }
  return true;
}

function updateSowSheetToggleLabel(){
  var button = el('sow-sheet-toggle');
  if(!button) return;
  var selected = sowSheetOptions.filter(function(sheet){
    return sowSelectedSheetIndexes[sheet.index];
  });
  if(!selected.length){
    button.textContent = 'Select sheets';
    return;
  }
  var names = selected.map(function(sheet){ return sheet.name; });
  button.textContent = names.length <= 2 ? names.join(', ') : names.length + ' sheets selected';
}

function renderSowSheetPicker(){
  var picker = el('sow-sheet-picker');
  var button = el('sow-sheet-toggle');
  var menu = el('sow-sheet-menu');
  var message = el('sow-sheet-message');
  if(!picker || !button || !menu || !message) return;

  var visible = sowSheetsLoading || sowSheetsLoaded || Boolean(sowSheetsError);
  picker.style.display = visible ? 'block' : 'none';
  menu.style.display = sowSheetsMenuOpen && sowSheetOptions.length ? 'block' : 'none';
  button.disabled = sowSheetsLoading || !sowSheetOptions.length;

  if(sowSheetsLoading){
    button.textContent = 'Loading sheets…';
    menu.innerHTML = '';
    message.textContent = '';
    message.className = 'sow-sheet-picker__message';
    return;
  }

  if(sowSheetsError){
    button.textContent = 'Select sheets';
    menu.innerHTML = '';
    message.textContent = sowSheetsError;
    message.className = 'sow-sheet-picker__message sow-sheet-picker__message--error';
    return;
  }

  message.textContent = sowSheetOptions.length ? '' : 'No sheets were found for this file.';
  message.className = sowSheetOptions.length
    ? 'sow-sheet-picker__message'
    : 'sow-sheet-picker__message sow-sheet-picker__message--error';

  menu.innerHTML = sowSheetOptions.map(function(sheet){
    var checked = sowSelectedSheetIndexes[sheet.index] ? ' checked' : '';
    return '<label class="sow-sheet-picker__option">'+
      '<input type="checkbox" value="'+sheet.index+'"'+checked+'>'+
      '<span>'+esc(sheet.name)+'</span>'+
    '</label>';
  }).join('');
  updateSowSheetToggleLabel();
  if(visible) expandSection('sec1');
}

function toggleSowSheetMenu(event){
  if(event){
    event.preventDefault();
    event.stopPropagation();
  }
  if(sowSheetsLoading || !sowSheetOptions.length) return;
  sowSheetsMenuOpen = !sowSheetsMenuOpen;
  var menu = el('sow-sheet-menu');
  if(menu) menu.style.display = sowSheetsMenuOpen ? 'block' : 'none';
  if(sowSheetsMenuOpen) expandSection('sec1');
}

function onSowSheetMenuChange(event){
  var input = event && event.target;
  if(!input || input.type !== 'checkbox') return;
  var index = Number(input.value);
  if(!Number.isFinite(index)) return;
  if(input.checked) sowSelectedSheetIndexes[index] = true;
  else delete sowSelectedSheetIndexes[index];
  updateSowSheetToggleLabel();
  clearSplitValidation();
}

function requestSowSheets(){
  var source = getSowSplitSource();
  if(!source){
    clearSowSheetPicker();
    return;
  }
  if(source.type === 'existing' && !sowProjectJobId){
    sowSheetsLoading = false;
    sowSheetsError = 'Select a project before loading sheets for an EMS file.';
    sowSheetOptions = [];
    sowSelectedSheetIndexes = {};
    renderSowSheetPicker();
    return;
  }

  if(sowSheetsAbort) sowSheetsAbort.abort();
  var controller = new AbortController();
  sowSheetsAbort = controller;
  var requestId = ++sowSheetsRequestId;
  sowSheetsLoading = true;
  sowSheetsLoaded = false;
  sowSheetsError = '';
  sowSheetOptions = [];
  sowSelectedSheetIndexes = {};
  sowSheetsMenuOpen = false;
  renderSowSheetPicker();
  expandSection('sec1');

  var request = source.type === 'upload'
    ? { type: 'upload', file: source.file, jobId: sowProjectJobId || undefined }
    : { type: 'existing', jobId: sowProjectJobId, filePath: source.file_path };

  if(typeof window.fetchSowSheets !== 'function'){
    sowSheetsLoading = false;
    sowSheetsError = 'Sheet service is not ready. Please refresh the page.';
    renderSowSheetPicker();
    return;
  }

  window.fetchSowSheets(request, controller.signal).then(function(response){
    if(requestId !== sowSheetsRequestId) return;
    sowSheetsLoading = false;
    sowSheetsLoaded = true;
    sowSheetsError = '';
    var sheets = response && Array.isArray(response.sheets) ? response.sheets : [];
    sowSheetOptions = sheets.filter(function(sheet){
      return sheet && sheet.name && Number.isFinite(Number(sheet.index));
    }).map(function(sheet){
      return { name: String(sheet.name), index: Number(sheet.index), hidden: Boolean(sheet.hidden) };
    });
    renderSowSheetPicker();
  }).catch(function(err){
    if(requestId !== sowSheetsRequestId) return;
    if(err && (err.name === 'AbortError' || err.code === 'ERR_CANCELED')) return;
    sowSheetsLoading = false;
    sowSheetsLoaded = true;
    sowSheetOptions = [];
    sowSheetsError = err && err.message ? err.message : 'Could not load sheets.';
    renderSowSheetPicker();
  });
}

document.addEventListener('click', function(event){
  if(!sowSheetsMenuOpen) return;
  var picker = el('sow-sheet-picker');
  if(picker && event.target && picker.contains(event.target)) return;
  sowSheetsMenuOpen = false;
  var menu = el('sow-sheet-menu');
  if(menu) menu.style.display = 'none';
});

function renderSplitProcessingSteps(){
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
}

function startSplitStepAnimation(){
  stopSplitStepAnimation();
  stepActive(0);
  sowSplitStepTimers = [
    setTimeout(function(){ stepDone(0); stepActive(1); }, 15000),
    setTimeout(function(){ stepDone(1); stepActive(2); }, 35000),
    setTimeout(function(){ stepDone(2); stepActive(3); }, 60000),
    setTimeout(function(){ stepDone(3); stepActive(4); }, 85000),
  ];
}

function startSplitStepAnimationFast(){
  stopSplitStepAnimation();
  stepActive(0);
  sowSplitStepTimers = [
    setTimeout(function(){ stepDone(0); stepActive(1); }, 400),
    setTimeout(function(){ stepDone(1); stepActive(2); }, 900),
    setTimeout(function(){ stepDone(2); stepActive(3); }, 1400),
    setTimeout(function(){ stepDone(3); stepActive(4); }, 1900),
  ];
}

function stopSplitStepAnimation(){
  if(!sowSplitStepTimers) return;
  sowSplitStepTimers.forEach(function(timer){ clearTimeout(timer); });
  sowSplitStepTimers = null;
}

function normalizeSowSplitTrades(response){
  if(!response) return null;
  if(response.tabs && Array.isArray(response.tabs.trade_documents) && response.tabs.trade_documents.length){
    return response.tabs.trade_documents;
  }
  if(Array.isArray(response)) return response;
  if(Array.isArray(response.trades)) return response.trades;
  if(Array.isArray(response.data)) return response.data;
  if(response.outputs && Array.isArray(response.outputs.trades)) return response.outputs.trades;
  if(response.result && Array.isArray(response.result.trades)) return response.result.trades;
  return null;
}

function normalizeTradeDocument(trade){
  if(!trade) return null;
  var items = Array.isArray(trade.items) ? trade.items : [];
  var codes = [];
  if(Array.isArray(trade.nbs) && trade.nbs.length) codes = trade.nbs;
  else if(Array.isArray(trade.code) && trade.code.length) codes = trade.code;
  else if(typeof trade.code === 'string' && trade.code) codes = [trade.code];
  return {
    id: trade.id || '',
    label: trade.label || trade.trade_name || trade.id || 'Trade',
    nbs: codes,
    section: trade.section || trade.label || '',
    lineCount: trade.lineCount != null ? trade.lineCount : items.length,
    items: items,
    overarching_trades: readOverarchingTradeNames(trade),
    unallocated: trade.id === 'unallocated' || Boolean(trade.unallocated)
  };
}

function readOverarchingTradeNames(trade){
  var raw = trade && (trade.overarching_trades || trade.overarchingTrades);
  if(!Array.isArray(raw)) return [];
  var names = [];
  raw.forEach(function(name){
    var text = String(name == null ? '' : name).trim();
    if(text && names.indexOf(text) < 0) names.push(text);
  });
  return names;
}

function isCatalogueTradeLabel(label){
  return /^[A-Z]{1,4}\d{0,4}\s*[—–-]/.test(String(label || '').trim());
}

function pricingExcelTradeId(doc, normalized){
  var downloadId = doc && (doc.download_id || doc.downloadId);
  if(downloadId) return String(downloadId).trim();
  var id = String((normalized && normalized.id) || (doc && doc.id) || '').trim();
  if(id.indexOf('overarching:') === 0) return id;
  var rawTrade = doc && (doc.trade_id || doc.tradeId);
  if(rawTrade && String(rawTrade).indexOf('overarching:') === 0) return String(rawTrade).trim();
  var name = String(doc && (doc.overarching || doc.overarching_trade || doc.overarchingTrade) || '').trim();
  if(name && name.toUpperCase() !== 'N/A') return 'overarching:' + name;
  var label = String((normalized && normalized.label) || (doc && (doc.label || doc.trade_name)) || '').trim();
  if(label && !isCatalogueTradeLabel(label) && id !== 'unallocated' && id !== 'general') return 'overarching:' + label;
  return id;
}

function normalizePricingDocument(doc){
  if(!doc) return null;
  var base = normalizeTradeDocument(doc);
  if(!base) return null;
  if(!base.id){
    var label = String(doc.label || doc.name || '').trim();
    base.id = label ? 'overarching:' + label : '';
    if(label) base.label = label;
  }
  base.excelTradeId = pricingExcelTradeId(doc, base);
  return base.id ? base : null;
}

function readPricingDocuments(tabs, catalogueTrades){
  var raw = tabs && tabs.pricing_documents;
  if(Array.isArray(raw)){
    return raw.map(normalizePricingDocument).filter(function(doc){ return doc && doc.id; });
  }
  return (catalogueTrades || []).map(function(trade){
    return Object.assign({}, trade, { excelTradeId: trade.id });
  });
}

function hiddenSharedStorageKey(){
  return 'sow-hidden-shared:' + (sowProjectJobId || '');
}

function readHiddenSharedIds(){
  try {
    var raw = sessionStorage.getItem(hiddenSharedStorageKey());
    var ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids : [];
  } catch (e) {
    return [];
  }
}

function writeHiddenSharedIds(ids){
  try {
    sessionStorage.setItem(hiddenSharedStorageKey(), JSON.stringify(ids));
  } catch (e) {}
}

function rememberHiddenSharedId(id){
  if(!id) return;
  var ids = readHiddenSharedIds();
  if(ids.indexOf(id) < 0) ids.push(id);
  writeHiddenSharedIds(ids);
}

function forgetHiddenSharedId(id){
  if(!id) return;
  writeHiddenSharedIds(readHiddenSharedIds().filter(function(saved){ return saved !== id; }));
}

function isActiveSharedItem(item){
  if(!item) return false;
  var flag = item.is_shared;
  var explicitlyShared = flag === true || String(flag).toLowerCase() === 'true';
  var explicitlyHidden = flag === false || flag === 0 || String(flag).toLowerCase() === 'false';
  var trades = Array.isArray(item.trades) ? item.trades : [];
  var tradeCount = item.trade_count != null && item.trade_count !== '' ? Number(item.trade_count) : null;
  var onlyOneTrade = trades.length === 1 || (tradeCount != null && !isNaN(tradeCount) && tradeCount < 2);
  if(explicitlyShared && trades.length >= 2){
    forgetHiddenSharedId(item.id);
    return true;
  }
  if(explicitlyHidden || onlyOneTrade){
    rememberHiddenSharedId(item.id);
    return false;
  }
  if(item.id && readHiddenSharedIds().indexOf(item.id) >= 0) return false;
  return true;
}

function normalizeSharedItem(item){
  if(!item) return null;
  return {
    id: item.id || '',
    ref: item.ref || '',
    desc: item.desc || '',
    version: Number.isFinite(Number(item.version)) ? Number(item.version) : 0,
    is_shared: !(item.is_shared === false || item.is_shared === 0 || String(item.is_shared).toLowerCase() === 'false'),
    trade_count: item.trade_count != null && item.trade_count !== '' ? Number(item.trade_count) : (Array.isArray(item.trades) ? item.trades.length : 0),
    trades: Array.isArray(item.trades) ? item.trades.map(function(t){
      return {
        trade_id: t.trade_id || t.tradeId || '',
        trade: t.trade || '',
        nbs: t.nbs || '',
        lead: Boolean(t.lead),
        scope: t.scope || '',
        note: t.note || ''
      };
    }) : []
  };
}

function normalizeFullScheduleItem(item, sheetName){
  if(!item) return null;
  var ref = item.ref || '';
  var itemKey = item.item_key || item.itemKey || '';
  if(!ref && !itemKey) return null;
  var sourceSheet = item.source_sheet || item.sourceSheet || sheetName || '';
  return {
    ref: ref,
    item_key: itemKey || ((sourceSheet || 'Full Schedule') + '::' + ref),
    source_sheet: sourceSheet,
    desc: item.desc || '',
    qty: item.qty != null ? item.qty : '',
    unit: item.unit || '',
    section: item.section || '',
    tradeId: item.tradeId || '',
    tradeLabel: item.tradeLabel || '',
    overarching_trade: item.overarching_trade || item.overarchingTrade || '',
    match_confidence: normalizeMatchConfidence(item.match_confidence || item.matchConfidence)
  };
}

function readFullScheduleSheets(raw){
  var sheets = [];
  function rowsFor(list, sheetName){
    var source = Array.isArray(list) ? list : [];
    return source.map(function(item){
      return normalizeFullScheduleItem(item, sheetName);
    }).filter(function(item){ return item && item.ref; });
  }
  if(Array.isArray(raw)){
    var legacy = rowsFor(raw, 'Full Schedule');
    if(legacy.length) sheets.push({ name: 'Full Schedule', items: legacy });
    return sheets;
  }
  if(raw && typeof raw === 'object'){
    Object.keys(raw).forEach(function(name){
      sheets.push({ name: name, items: rowsFor(raw[name], name) });
    });
  }
  return sheets;
}

function rememberActiveScheduleSheet(){
  var names = sowScheduleSheets.map(function(sheet){ return sheet.name; });
  if(names.indexOf(sowActiveScheduleSheet) < 0){
    sowActiveScheduleSheet = names.length ? names[0] : '';
  }
}

function activeScheduleSheet(){
  var found = null;
  sowScheduleSheets.forEach(function(sheet){
    if(sheet.name === sowActiveScheduleSheet) found = sheet;
  });
  return found || sowScheduleSheets[0] || null;
}

function selectScheduleSheet(name){
  if(!name || name === sowActiveScheduleSheet) return;
  var exists = sowScheduleSheets.some(function(sheet){ return sheet.name === name; });
  if(!exists) return;
  sowActiveScheduleSheet = name;
  sowScheduleSheetScrollLocked = true;
  renderScheduleView();
}

function normalizeMatchConfidence(value){
  var key = String(value || '').trim().toLowerCase();
  if(key === 'high' || key === 'medium' || key === 'low') return key;
  return '';
}

function applySowSplitResponse(response){
  if(!response) return false;
  sowSplitResponse = response;

  var tabs = response.tabs || {};
  var tradeDocs = Array.isArray(tabs.trade_documents) ? tabs.trade_documents : [];
  if(!tradeDocs.length) tradeDocs = normalizeSowSplitTrades(response) || [];

  splitTrades = tradeDocs.map(normalizeTradeDocument).filter(function(t){ return t && t.id; });
  pricingDocuments = readPricingDocuments(tabs, splitTrades);
  if(!splitTrades.length && !pricingDocuments.length) return false;

  var rawSchedule = tabs.full_schedule;
  sowScheduleSheets = readFullScheduleSheets(rawSchedule);
  var hasSheetEntries = rawSchedule != null && !Array.isArray(rawSchedule) && typeof rawSchedule === 'object' && Object.keys(rawSchedule).length > 0;
  if(!sowScheduleSheets.length && !hasSheetEntries){
    var fallback = [];
    splitTrades.forEach(function(t){
      (t.items || []).forEach(function(item){
        fallback.push(normalizeFullScheduleItem({
          ref: item.ref,
          desc: item.desc,
          qty: item.qty,
          unit: item.unit,
          section: item.section || t.section || t.label,
          tradeId: t.id,
          tradeLabel: t.label,
          overarching_trade: item.overarching_trade || item.overarchingTrade || '',
          match_confidence: item.match_confidence || item.matchConfidence,
          item_key: item.item_key || item.itemKey || ''
        }, 'Full Schedule'));
        });
      });
    fallback = fallback.filter(function(item){ return item && item.ref; });
    if(fallback.length) sowScheduleSheets = [{ name: 'Full Schedule', items: fallback }];
  }
  rememberActiveScheduleSheet();
  var activeSheet = activeScheduleSheet();
  sowFullSchedule = activeSheet ? activeSheet.items.slice() : [];

  var shared = Array.isArray(tabs.shared_items) ? tabs.shared_items : [];
  SHARED_ITEMS = shared.filter(isActiveSharedItem).map(normalizeSharedItem).filter(function(i){ return i && i.ref; });

  applyRevisionDiffFromResponse(tabs.revision_diff);

  // Wire backend compliance into the engine's compliance panel.
  // When tabs.compliance is present (set by the inline compliance check in POST /sow/split),
  // adapt it to the engine's complianceResults shape and render the panel immediately —
  // no need for the user to re-upload files in Section 2.
  // The Section-2 manual check flow remains active and will override this if the user runs it.
  if (tabs.compliance) {
    var adapted = _adaptBackendCompliance(tabs.compliance);
    if (adapted) {
      complianceResults = adapted;
      if (typeof renderCompliancePanel === 'function') renderCompliancePanel();
    }
  } else if (typeof renderComplianceView === 'function') {
    renderComplianceView();
  }

  var activePricing = pricingDocuments.some(function(doc){ return doc.id === splitActiveTrade; });
  if(!activePricing) splitActiveTrade = pricingDocuments[0] ? pricingDocuments[0].id : null;
  return true;
}

function normalizeRevisionStatus(status){
  var s = String(status || '').trim().toLowerCase();
  if(s === 'new' || s === 'added') return 'new';
  if(s === 'amended' || s === 'modified' || s === 'changed') return 'amended';
  if(s === 'deleted' || s === 'removed') return 'deleted';
  if(s === 'unchanged') return 'unchanged';
  return s || 'unchanged';
}

function normalizeApiRevisionDiff(apiDiff){
  if(!apiDiff || typeof apiDiff !== 'object') return null;
  var summary = apiDiff.summary || {};
  var changes = Array.isArray(apiDiff.changes) ? apiDiff.changes : [];
  var newCount = summary.new_items != null ? summary.new_items : (summary.new || 0);
  var amendedCount = summary.amended_items != null ? summary.amended_items : (summary.amended || 0);
  var deletedCount = summary.deleted_items != null ? summary.deleted_items : (summary.deleted || 0);
  var unchangedCount = summary.unchanged_items != null ? summary.unchanged_items : (summary.unchanged || 0);

  return {
    revisionRef: apiDiff.revision_ref || apiDiff.revisionRef || null,
    revisionTitle: apiDiff.revision_title || apiDiff.revisionTitle || apiDiff.title || null,
    revisionDate: apiDiff.revision_date || apiDiff.revisionDate || null,
    summary: {
      new: newCount,
      amended: amendedCount,
      deleted: deletedCount,
      unchanged: unchangedCount,
      total: newCount + amendedCount + deletedCount + unchangedCount
    },
    changes: changes.map(function(c){
      var oldItem = c.old_item || {};
      var newItem = c.new_item || {};
      var changeType = normalizeRevisionStatus(c.status || c.changeType);
      return {
        changeType: changeType,
        ref: c.ref || '',
        tradeId: c.trade_id || c.tradeId || '',
        tradeLabel: c.trade || c.trade_label || c.tradeLabel || '',
        section: c.category || c.section || '',
        changeNotes: c.change_summary || c.changeNotes || '',
        changeTypeLabel: c.change_type || c.changeTypeLabel || '',
        currentDesc: oldItem.desc != null ? oldItem.desc : (c.currentDesc != null ? c.currentDesc : null),
        currentQty: oldItem.qty != null ? oldItem.qty : (c.currentQty != null ? c.currentQty : null),
        currentUnit: oldItem.unit || c.currentUnit || null,
        revisedDesc: newItem.desc != null ? newItem.desc : (c.revisedDesc != null ? c.revisedDesc : null),
        revisedQty: newItem.qty != null ? newItem.qty : (c.revisedQty != null ? c.revisedQty : null),
        revisedUnit: newItem.unit || c.revisedUnit || null
      };
    })
  };
}

function applyRevisionDiffFromResponse(apiDiff){
  if(!apiDiff){
    revisionResults = null;
    updateRevisionBadge();
    return;
  }
  var normalized = normalizeApiRevisionDiff(apiDiff);
  revisionResults = normalized;
  updateRevisionBadge();
}

function updateRevisionBadge(){
  var badge = el('revision-count-badge');
  if(!badge) return;
  if(!revisionResults || !revisionResults.summary){
    badge.style.display = 'none';
    return;
  }
  var s = revisionResults.summary;
  var changed = (s.new || 0) + (s.amended || 0) + (s.deleted || 0);
  if(changed > 0){
    badge.style.display = 'inline';
    badge.textContent = changed + ' change' + (changed === 1 ? '' : 's');
  } else {
    badge.style.display = 'none';
  }
}

function clearRevisionResults(){
  revisionResults = null;
  updateRevisionBadge();
  var revLive = document.getElementById('revision-live-results');
  if(revLive) revLive.remove();
  var revEx = el('revision-example');
  if(revEx) revEx.style.display = 'block';
}

function clearSplitResultsOnly(){
  splitTrades = [];
  pricingDocuments = [];
  splitActiveTrade = null;
  sowFullSchedule = [];
  sowScheduleSheets = [];
  sowActiveScheduleSheet = '';
  sowScheduleSheetScrollLeft = 0;
  sowScheduleSheetScrollLocked = false;
  sowSplitResponse = null;
  SHARED_ITEMS = [];
  scheduleChanges = {};
  scheduleOverarchingChanges = {};
  var emptyEl = el('split-empty');
  var resultsEl = el('split-results');
  var procEl = el('split-processing');
  if(emptyEl) emptyEl.style.display = 'flex';
  if(resultsEl) resultsEl.style.display = 'none';
  if(procEl) procEl.style.display = 'none';
  sowSplitProcessing = false;
  updateSplitRunBtnState();
  var badge = el('shared-count-badge');
  if(badge){
    badge.textContent = '0';
    badge.style.display = 'none';
  }
  setWorkbookTabVisible(false);
  clearRevisionResults();
}

function beginSplitProcessing(label){
  clearSplitValidation();
  if(el('split-empty')) el('split-empty').style.display = 'none';
  if(el('split-results')) el('split-results').style.display = 'none';
  if(el('split-processing')) el('split-processing').style.display = 'flex';
  sowSplitProcessing = true;
  updateSplitRunBtnState();
  if(el('split-proc-file')) el('split-proc-file').textContent = label;
  renderSplitProcessingSteps();
}

function completeSplitProcessingSteps(){
  stopSplitStepAnimation();
  for(var i = 0; i < 5; i++){ stepDone(i); }
}

function handleSowSplitResponseResult(response, delayMs){
  if(response && response.status && response.status !== 'success'){
    throw new Error('Trade split did not complete successfully.');
  }
  if(!applySowSplitResponse(response)){
    throw new Error('Trade split response did not include any trade documents.');
  }
  setTimeout(showSplitResults, delayMs != null ? delayMs : 300);
}

function failSplitProcessing(msg){
  stopSplitStepAnimation();
  sowSplitProcessing = false;
  updateSplitRunBtnState();
  el('split-processing').style.display = 'none';
  el('split-results').style.display = 'none';
  el('split-empty').style.display = 'flex';
  showSplitValidation(msg || 'Trade split failed. Please try again.');
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
  var source = getSowSplitSource();
  if(!source){
    showSplitValidation('Please select a schedule from EMS or upload a document in Step 1.');
    return;
  }

  if(!sowSheetsReadyForRun()) return;

  if(!sowProjectJobId){
    window.dispatchEvent(new CustomEvent('sow-request-create-project'));
    return;
  }

  clearSplitValidation();
  beginSplitProcessing('Processing: '+source.label);
  startSplitStepAnimation();

  var request = buildSplitRequest(source);
  if(revFile){
    request.revised_file = revFile;
  }

  try {
    if(typeof window.submitSowSplit !== 'function'){
      throw new Error('Split service is not ready. Please refresh the page.');
    }
    var requestJobId = sowProjectJobId;
    var response = await window.submitSowSplit(requestJobId, request);
    if(requestJobId !== sowProjectJobId) return;
    console.log(response);
    completeSplitProcessingSteps();
    handleSowSplitResponseResult(response);
    return;
  } catch(e) {
    failSplitProcessing(e && e.message ? e.message : 'Trade split failed. Please try again.');
  }
}

window.runSplit = runSplit;

function buildSplitRequest(source){
  var splitOptions = getSowTradeSplitOptions();
  var request = {
    type: source.type,
    method: splitOptions.method,
    inclPrelims: splitOptions.inclPrelims,
    inclBwic: splitOptions.inclBwic,
    sheet_indexes: selectedSowSheetIndexes()
  };
  if(source.type === 'existing'){
    request.file_path = source.file_path;
  } else {
    request.file = source.file;
  }
  if(supportingFiles.spec.length){
    request.specifications = supportingFiles.spec.slice();
  }
  if(supportingFiles.dwg.length){
    request.drawings = supportingFiles.dwg.slice();
  }
  return request;
}

window.runLoadSavedSowSplit = async function(jobId, signal){
  var trimmed = jobId ? String(jobId).trim() : '';
  var gen = ++sowSplitLoadGeneration;

  if(!trimmed){
    stopSplitStepAnimation();
    clearSplitResultsOnly();
    return;
  }

  if(trimmed !== sowProjectJobId){
    return;
  }

  beginSplitProcessing('Loading saved trade split…');
  startSplitStepAnimationFast();

  try {
    if(typeof window.fetchSavedSowSplit !== 'function'){
      throw new Error('Split load service is not ready. Please refresh the page.');
    }
    var response = await window.fetchSavedSowSplit(trimmed, signal);
    if(signal && signal.aborted) return;
    if(gen !== sowSplitLoadGeneration) return;
    if(trimmed !== sowProjectJobId) return;

    console.log('[schedule-of-works] GET /sow/split', response);
    completeSplitProcessingSteps();

    if(!response){
      clearSplitResultsOnly();
      return;
    }

    handleSowSplitResponseResult(response, 200);
  } catch(e) {
    if(signal && signal.aborted) return;
    if(gen !== sowSplitLoadGeneration) return;
    console.error('[schedule-of-works] GET /sow/split failed', e);
    stopSplitStepAnimation();
    clearSplitResultsOnly();
  }
};

window.cancelLoadSavedSowSplit = function(){
  sowSplitLoadGeneration++;
  stopSplitStepAnimation();
};

function updateSplitResultSummary(){
  var totalItems=pricingDocuments.reduce(function(s,t){
    return s + (t.lineCount != null ? t.lineCount : (t.items || []).length);
  }, 0);
  var tradeCount=splitTrades.length || pricingDocuments.length;
  var titleEl=el('split-result-title');
  var subEl=el('split-result-sub');
  if(titleEl) titleEl.textContent=tradeCount+' trades identified';
  if(subEl) subEl.textContent=totalItems+' line items across '+pricingDocuments.length+' pricing documents';
}

function updateSharedCountBadge(count){
  var badge=el('shared-count-badge');
  if(!badge) return;
  var total = typeof count === 'number' ? count : SHARED_ITEMS.length;
  badge.textContent=total;
  badge.style.display=total>0?'':'none';
  badge.style.background=total>0?'var(--amber-bg)':'var(--bg)';
}

function showSplitResults(){
  el('split-processing').style.display='none';
  el('split-results').style.display='flex';
  sowSplitProcessing = false;
  updateSplitRunBtnState();
  updateSplitResultSummary();
  renderSplitTradeList();
  renderSplitPreview(splitActiveTrade);
  if(revisionResults){
    updateRevisionBadge();
    switchResultTab('revision');
  } else {
    switchResultTab('schedule');
  }
  updateRevBtn();
}

function renderSplitTradeList(){
  var container=el('split-trade-list');
  container.innerHTML='';
  pricingDocuments.forEach(function(t){
    var isActive=t.id===splitActiveTrade;
    var isUnalloc=t.id==='unallocated';
    var isGeneral=t.id==='general';
    var btn=document.createElement('button');
    btn.type='button';
    btn.setAttribute('data-trade-id',t.id);
    btn.className='split-trade-item'+
      (isActive?' split-trade-item--active':'')+
      (isUnalloc?' split-trade-item--unalloc':'')+
      (isGeneral?' split-trade-item--general':'');
    var prefix=isUnalloc?'&#9888; ':isGeneral?'&#9685; ':'';
    var nbsBadges=t.nbs&&t.nbs.length?t.nbs.map(function(n){
      return '<span class="split-trade-item__tag">'+esc(n)+'</span>';
    }).join(''):'';
    var tagsRow=nbsBadges?'<div class="split-trade-item__tags">'+nbsBadges+'</div>':'';
    var countClass='split-trade-item__count'+(isUnalloc&&t.lineCount>0?' split-trade-item__count--warn':'');
    btn.innerHTML=
      '<div class="split-trade-item__main">'+
        '<div class="split-trade-item__label">'+prefix+esc(t.label)+'</div>'+
        tagsRow+
      '</div>'+
      '<div class="'+countClass+'">'+t.lineCount+' items</div>';
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
  var t=pricingDocuments.find(function(x){return x.id===id;});
  if(!t)return;
  var isUnalloc=t.id==='unallocated';
  var isGeneral=t.id==='general';
  var filename=t.label.replace(/[^a-zA-Z0-9 ]/g,'').replace(/\s+/g,'-')+'_Pricing.xlsx';
  var nbsBadges=t.nbs&&t.nbs.length
    ?t.nbs.map(function(n){return '<span class="badge b-purple" style="margin-right:4px">'+esc(n)+'</span>';}).join('')+' &middot; '
    :'';

  var headerDiv=document.createElement('div');
  headerDiv.className='flex-b mb16';
  headerDiv.innerHTML=
    '<div>'+
      '<div style="font-size:17px;font-weight:700;color:'+(isUnalloc?'var(--red)':'var(--text)')+'">'+
        (isUnalloc?'&#9888; ':isGeneral?'&#9685; ':'')+esc(t.label)+
      '</div>'+
      '<div style="font-size:12px;color:var(--text-light);margin-top:3px">'+nbsBadges+t.lineCount+' items</div>'+
      (isUnalloc?'<div style="font-size:12px;color:var(--red);margin-top:5px">These items could not be automatically assigned to a trade — use the Allocate button to assign each one manually.</div>':'')+
    '</div>';

  var actionDiv=document.createElement('div');
  actionDiv.className='flex-g';
  if(!isUnalloc){
    var dlBtn=document.createElement('button');
    dlBtn.className='btn btn-primary btn-sm';
    dlBtn.innerHTML='&#8681; Download Excel';
    dlBtn.setAttribute('data-trade-id',id);
    dlBtn.onclick=function(){downloadTradeExcel(this.getAttribute('data-trade-id'), this);};
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
        '<div style="padding:7px 8px;font-size:11px;color:#333;line-height:1.4">'+
          (isSharedItemRef(item.ref)?'<span style="font-size:10px;font-weight:700;color:var(--amber);background:var(--amber-bg);border:1px solid rgba(196,123,0,.25);padding:1px 6px;border-radius:8px;margin-right:6px">SHARED</span>':'')+
          esc(item.desc)+
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

function triggerSowFileDownload(blob, filename){
  var url = URL.createObjectURL(blob);
  var anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'download';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function withSowDownloadButton(btn, work){
  if(!btn) return work();
  var origHtml = btn.innerHTML;
  var origDisabled = btn.disabled;
  btn.disabled = true;
  btn.innerHTML = '<span style="animation:spin .8s linear infinite;display:inline-block">&#8635;</span> Downloading…';
  return Promise.resolve()
    .then(work)
    .finally(function(){
      btn.disabled = origDisabled;
      btn.innerHTML = origHtml;
    });
}

async function runSowDownload(exportType, tradeId, btn){
  if(!splitTrades.length && !pricingDocuments.length){
    alert('Run the AI Trade Split first.');
    return;
  }
  if(!sowProjectJobId){
    window.dispatchEvent(new CustomEvent('sow-needs-project'));
    alert('Select a project before downloading.');
    return;
  }
  if(exportType === 'trade' && !tradeId){
    alert('Select a trade first.');
    return;
  }
  return withSowDownloadButton(btn, async function(){
    if(typeof window.downloadSowExport !== 'function'){
      throw new Error('Download API is not available. Please refresh the page.');
    }
    var request = { type: exportType };
    if(exportType === 'trade' && tradeId) request.tradeId = tradeId;
    var result = await window.downloadSowExport(sowProjectJobId, request);
    triggerSowFileDownload(result.blob, result.filename);
  }).catch(function(e){
    alert(e && e.message ? e.message : 'Download failed.');
  });
}

function downloadTradeExcel(id, btn){
  var t = pricingDocuments.find(function(x){ return x.id === id; });
  if(!t) return;
  void runSowDownload('trade', t.excelTradeId || t.id, btn || null);
}
function downloadAllExcel(){
  void runSowDownload('all', null, el('sow-download-all-btn'));
}
function exportFullSchedule(){
  void runSowDownload('schedule', null, el('sow-export-schedule-btn'));
}
function sendToEnquiry(){
  alert(splitTrades.length+' trade packages sent to Enquiry Generation module. Trades are now available in Module 4.');
}
function resetSplit(){
  splitFile=null; splitTrades=[]; pricingDocuments=[]; splitActiveTrade=null;
  sowFullSchedule = [];
  sowScheduleSheets = [];
  sowActiveScheduleSheet = '';
  sowScheduleSheetScrollLeft = 0;
  sowScheduleSheetScrollLocked = false;
  sowSplitResponse = null;
  SHARED_ITEMS = [];
  scheduleChanges = {};
  scheduleOverarchingChanges = {};
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
  sowSplitProcessing = false;
  updateSplitRunBtnState();
  setWorkbookTabVisible(false);
}


function exportToEMS(){
  alert(splitTrades.length+' trade packages ready. Open the EMS and the trades will be available in the Enquiry Generation module.');
}


function renderSharedItems(){
  var panel=el('shared-items-panel');
  if(!panel) return;

  var headerHTML='<div class="flex-b mb16">'+
    '<div>'+
      '<div style="font-size:18px;font-weight:700;color:var(--text)">Shared Items</div>'+
      '<div style="font-size:13px;color:var(--text-light);margin-top:2px">'+SHARED_ITEMS.length+' items identified that span multiple trades</div>'+
    '</div>'+
    '<button class="btn btn-secondary btn-sm" id="sow-export-shared-btn" onclick="exportSharedItems()"'+(SHARED_ITEMS.length ? '' : ' disabled')+'>&#8681; Export Schedule</button>'+
  '</div>'+
  '<div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">'+
    '<span style="font-size:12px;color:var(--text-mid);display:flex;align-items:center;gap:5px"><span style="width:12px;height:12px;border-radius:2px;background:var(--amber-bg);border:1px solid rgba(196,123,0,.3);display:inline-block"></span>Lead trade</span>'+
    '<span style="font-size:12px;color:var(--text-mid);display:flex;align-items:center;gap:5px"><span style="width:12px;height:12px;border-radius:2px;background:var(--blue-bg);border:1px solid rgba(15,108,189,.3);display:inline-block"></span>Supporting trade</span>'+
  '</div>';

  panel.innerHTML=headerHTML;

  if(!SHARED_ITEMS.length){
    panel.insertAdjacentHTML('beforeend',
      '<div style="background:var(--white);border:1px solid var(--border);border-radius:8px;padding:32px 24px;text-align:center;color:var(--text-light)">'+
        '<div style="font-size:28px;opacity:.2;margin-bottom:8px">&#128279;</div>'+
        '<div style="font-size:14px;font-weight:600;color:var(--text-mid)">No shared items identified</div>'+
        '<div style="font-size:12.5px;margin-top:6px;line-height:1.5">Items spanning multiple trades will appear here after a successful trade split.</div>'+
      '</div>'
    );
    return;
  }

  SHARED_ITEMS.forEach(function(item){
    var card=document.createElement('div');
    card.style.cssText='background:var(--white);border:1px solid var(--border);border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05);margin-bottom:16px';

    // Card header
    var tradeBadges=item.trades.map(function(t){
      var col=resolveSharedTradeColor(t.trade);
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
    editBtn.textContent='Add';
    editBtn.style.cssText='flex-shrink:0;background:transparent;border:1px solid var(--border);border-radius:4px;padding:5px 10px;font-size:12px;font-weight:600;cursor:pointer;color:var(--text-mid);font-family:DM Sans,sans-serif';
    editBtn.setAttribute('data-item-id', item.id);
    editBtn.onclick=function(){ openAddSharedTrade(item); };
    hdr.appendChild(editBtn);
    card.appendChild(hdr);

    // Trade rows
    item.trades.forEach(function(t){
      var col=resolveSharedTradeColor(t.trade);
      var isLead=t.lead;
      var row=document.createElement('div');
      row.className='sow-shared-trade'+(isLead?' sow-shared-trade--lead':'');
      var top=document.createElement('div');
      top.className='sow-shared-trade__head'+(isLead?'':' sow-shared-trade__head--delete');
      top.innerHTML='<span class="sow-shared-trade__badge" style="background:'+col+'18;color:'+col+';border-color:'+col+'28">'+(isLead?'&#9733; LEAD':'SUPPORTING')+'</span>'+
          '<span class="sow-shared-trade__name">'+esc(t.trade)+'</span>'+
          '<span class="sow-shared-trade__code">'+esc(t.nbs)+'</span>';
      row.appendChild(top);
      if(!isLead){
        var del=document.createElement('button');
        del.type='button';
        del.className='sow-shared-delete';
        del.setAttribute('aria-label', 'Remove '+t.trade);
        del.title='Remove';
        del.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
        del.onclick=function(){ removeSharedItemTrade(item, t, del); };
        row.appendChild(del);
      }
      var scope=document.createElement('div');
      scope.style.cssText='font-size:12.5px;color:var(--text-mid);line-height:1.6;margin-bottom:6px';
      scope.innerHTML='<strong style="color:var(--text)">Scope: </strong>'+esc(t.scope);
      row.appendChild(scope);
      if(t.note){
        var noteLine=document.createElement('div');
        noteLine.style.cssText='font-size:11.5px;font-style:italic;color:'+(isLead?'var(--amber)':'var(--blue)');
        noteLine.textContent=t.note;
        row.appendChild(noteLine);
      }

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

function sowDialog(options){
  if(typeof window.sowDialog === 'function') return window.sowDialog(options);
  if(options && options.showCancelButton){
    return Promise.resolve({ isConfirmed: confirm(options.text || options.title || '') });
  }
  alert((options && (options.text || options.title)) || '');
  return Promise.resolve({ isConfirmed: true });
}

function sharedTradeId(trade){
  if(trade && trade.trade_id) return String(trade.trade_id);
  var match = splitTrades.find(function(t){ return t.label === trade.trade; });
  return match && match.id ? String(match.id) : '';
}

function applySharedItemPatch(itemId, response){
  var nextRaw = response && response.shared_item ? response.shared_item : null;
  var next = nextRaw ? normalizeSharedItem(nextRaw) : null;
  var active = nextRaw ? isActiveSharedItem(nextRaw) : false;
  var index = -1;
  SHARED_ITEMS.forEach(function(item, i){
    if(item.id === itemId || (next && next.ref && item.ref === next.ref)) index = i;
  });
  if(!active){
    rememberHiddenSharedId(itemId);
    if(next && next.id) rememberHiddenSharedId(next.id);
    if(index >= 0) SHARED_ITEMS.splice(index, 1);
  } else if(next){
    forgetHiddenSharedId(itemId);
    if(next.id) forgetHiddenSharedId(next.id);
    if(index >= 0) SHARED_ITEMS[index] = next;
    else SHARED_ITEMS.push(next);
  }
  if(sowSplitResponse && sowSplitResponse.tabs && Array.isArray(sowSplitResponse.tabs.shared_items)){
    sowSplitResponse.tabs.shared_items = sowSplitResponse.tabs.shared_items.filter(isActiveSharedItem);
  }
  updateSharedCountBadge();
  renderSharedItems();
}

async function removeSharedItemTrade(item, trade, button){
  if(!item || !trade || sowSharedItemRemoving) return;
  var tradeId = sharedTradeId(trade);
  if(!tradeId){
    await sowDialog({
      title: 'Cannot remove trade',
      text: 'This trade cannot be removed because its id is missing.',
      icon: 'error',
      confirmButtonText: 'OK'
    });
    return;
  }
  if(!sowProjectJobId){
    window.dispatchEvent(new CustomEvent('sow-needs-project'));
    await sowDialog({
      title: 'Select a project',
      text: 'Select a project before removing a trade.',
      icon: 'warning',
      confirmButtonText: 'OK'
    });
    return;
  }
  var confirmed = await sowDialog({
    title: 'Remove trade?',
    text: 'Remove '+trade.trade+' from '+(item.desc || item.ref || 'this shared item')+'?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Remove',
    cancelButtonText: 'Cancel'
  });
  if(!confirmed || !confirmed.isConfirmed) return;

  var remaining = (item.trades || []).filter(function(t){ return t !== trade; }).map(function(t){
    return { trade_id: sharedTradeId(t) };
  }).filter(function(t){ return t.trade_id; });
  if(!remaining.length){
    await sowDialog({
      title: 'Cannot remove trade',
      text: 'At least one trade must remain.',
      icon: 'warning',
      confirmButtonText: 'OK'
    });
    return;
  }

  sowSharedItemRemoving = true;
  if(button){
    button.disabled = true;
    button.classList.add('is-busy');
    button.setAttribute('aria-label', 'Removing '+trade.trade);
  }
  try {
    if(typeof window.patchSowSharedItem !== 'function'){
      throw new Error('Shared item service is not ready. Please refresh the page.');
    }
    var request = { trades: remaining };
    if(Number.isFinite(Number(item.version))) request.expected_version = Number(item.version);
    var response = await window.patchSowSharedItem(sowProjectJobId, item.id, request);
    applySharedItemPatch(item.id, response);
  } catch(e) {
    await sowDialog({
      title: 'Could not remove trade',
      text: e && e.message ? e.message : 'Could not remove this trade.',
      icon: 'error',
      confirmButtonText: 'OK'
    });
    if(button){
      button.disabled = false;
      button.classList.remove('is-busy');
      button.setAttribute('aria-label', 'Remove '+trade.trade);
    }
  } finally {
    sowSharedItemRemoving = false;
  }
}

function sharedAddChoices(item){
  var attached = {};
  (item.trades || []).forEach(function(trade){
    var id = sharedTradeId(trade);
    if(id) attached[id] = true;
  });
  return splitTrades.filter(function(trade){
    if(!trade || !trade.id || trade.unallocated || trade.id === 'unallocated') return false;
    if(attached[String(trade.id)]) return false;
    return sharedScopeRows(trade).length > 0;
  });
}

function sharedScopeRows(trade){
  var items = trade && Array.isArray(trade.items) ? trade.items : [];
  return items.filter(function(row){
    return String((row && (row.desc || row.description)) || '').trim();
  });
}

function sharedTradeChoiceLabel(trade){
  var codes = Array.isArray(trade.nbs) ? trade.nbs.filter(Boolean).join('/') : '';
  return codes ? trade.label + ' (' + codes + ')' : (trade.label || trade.id);
}

function closeAddSharedTrade(){
  var node = document.getElementById('sow-shared-add-modal');
  if(node) node.remove();
  document.removeEventListener('keydown', onAddSharedTradeKey);
}

function onAddSharedTradeKey(e){
  if(e.key === 'Escape' && !sowSharedItemRemoving) closeAddSharedTrade();
}

function createSharedPicker(placeholder){
  var root = document.createElement('div');
  root.className = 'sow-shared-add__picker';
  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'sow-shared-add__picker-btn';
  var label = document.createElement('span');
  label.className = 'sow-shared-add__picker-label is-placeholder';
  label.textContent = placeholder;
  var caret = document.createElement('span');
  caret.className = 'sow-shared-add__picker-caret';
  caret.setAttribute('aria-hidden', 'true');
  caret.textContent = '\u25BE';
  button.appendChild(label);
  button.appendChild(caret);
  var list = document.createElement('div');
  list.className = 'sow-shared-add__picker-list';
  list.hidden = true;
  root.appendChild(button);
  root.appendChild(list);
  var state = { value: '', scope: '', disabled: false, placeholder: placeholder, onChange: null };
  function close(){
    list.hidden = true;
    root.classList.remove('is-open');
  }
  function open(){
    if(state.disabled || !list.childElementCount) return;
    var openPickers = document.querySelectorAll('.sow-shared-add__picker.is-open');
    Array.prototype.forEach.call(openPickers, function(node){
      if(node === root) return;
      node.classList.remove('is-open');
      var other = node.querySelector('.sow-shared-add__picker-list');
      if(other) other.hidden = true;
    });
    list.hidden = false;
    root.classList.add('is-open');
  }
  button.onclick = function(e){
    e.stopPropagation();
    if(list.hidden) open();
    else close();
  };
  return {
    root: root,
    close: close,
    getValue: function(){ return state.value; },
    getScope: function(){ return state.scope; },
    setDisabled: function(disabled){
      state.disabled = disabled;
      button.disabled = disabled;
      if(disabled) close();
    },
    onChange: function(fn){ state.onChange = fn; },
    setPlaceholder: function(text){
      state.placeholder = text;
      if(!state.value){
        label.textContent = text;
        label.classList.add('is-placeholder');
      }
    },
    setOptions: function(options){
      list.innerHTML = '';
      state.value = '';
      state.scope = '';
      label.textContent = state.placeholder;
      label.classList.add('is-placeholder');
      close();
      options.forEach(function(opt){
        var row = document.createElement('button');
        row.type = 'button';
        row.className = 'sow-shared-add__picker-option';
        row.textContent = opt.label;
        row.onclick = function(e){
          e.stopPropagation();
          state.value = opt.value;
          state.scope = opt.scope || '';
          label.textContent = opt.label;
          label.classList.remove('is-placeholder');
          close();
          if(state.onChange) state.onChange();
        };
        list.appendChild(row);
      });
    }
  };
}

function openAddSharedTrade(item){
  if(!item || sowSharedItemRemoving) return;
  closeAddSharedTrade();
  var choices = sharedAddChoices(item);
  var modal = document.createElement('div');
  modal.id = 'sow-shared-add-modal';
  modal.className = 'sow-shared-add';
  var panel = document.createElement('div');
  panel.className = 'sow-shared-add__panel';
  var title = document.createElement('div');
  title.className = 'sow-shared-add__title';
  title.textContent = 'Add trade';
  var subtitle = document.createElement('p');
  subtitle.className = 'sow-shared-add__subtitle';
  subtitle.textContent = (item.ref ? item.ref + ' ' : '') + (item.desc || 'Shared item');
  panel.appendChild(title);
  panel.appendChild(subtitle);

  if(!choices.length){
    var empty = document.createElement('p');
    empty.className = 'sow-shared-add__empty';
    empty.textContent = 'No other trades with scope items are available to add.';
    panel.appendChild(empty);
  }

  var tradeLabel = document.createElement('label');
  tradeLabel.className = 'sow-shared-add__label';
  tradeLabel.textContent = 'Trade';
  var tradePicker = createSharedPicker('Select a trade');
  tradePicker.setOptions(choices.map(function(trade, index){
    return { value: String(index), label: sharedTradeChoiceLabel(trade) };
  }));
  tradePicker.setDisabled(!choices.length);

  var scopeLabel = document.createElement('label');
  scopeLabel.className = 'sow-shared-add__label';
  scopeLabel.textContent = 'Scope';
  var scopePicker = createSharedPicker('Select a trade first');
  scopePicker.setDisabled(true);

  var noteLabel = document.createElement('label');
  noteLabel.className = 'sow-shared-add__label';
  noteLabel.textContent = 'Coordination note';
  var noteInput = document.createElement('input');
  noteInput.type = 'text';
  noteInput.className = 'sow-shared-add__control';
  noteInput.placeholder = 'Optional';
  noteInput.disabled = !choices.length;

  tradePicker.onChange(function(){
    var trade = choices[Number(tradePicker.getValue())];
    scopePicker.setPlaceholder(trade ? 'Select a scope' : 'Select a trade first');
    scopePicker.setDisabled(!trade);
    scopePicker.setOptions(trade ? sharedScopeRows(trade).map(function(row, index){
      var desc = String(row.desc || row.description || '').trim();
      var ref = row.ref ? String(row.ref) : '';
      return { value: String(index), label: ref ? ref + ' — ' + desc : desc, scope: desc };
    }) : []);
    updateAddSharedTradeSave();
  });
  scopePicker.onChange(updateAddSharedTradeSave);

  var actions = document.createElement('div');
  actions.className = 'sow-shared-add__actions';
  var cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'sow-shared-add__cancel';
  cancel.textContent = 'Cancel';
  cancel.onclick = closeAddSharedTrade;
  var save = document.createElement('button');
  save.type = 'button';
  save.className = 'sow-shared-add__save';
  save.textContent = 'Save';
  save.disabled = true;
  var status = document.createElement('div');
  status.className = 'sow-shared-add__status';
  status.hidden = true;
  var statusSpin = document.createElement('span');
  statusSpin.className = 'sow-shared-add__spinner';
  statusSpin.setAttribute('aria-hidden', 'true');
  var statusText = document.createElement('span');
  statusText.textContent = 'Saving this trade…';
  status.appendChild(statusSpin);
  status.appendChild(statusText);
  save.onclick = function(){ saveAddedSharedTrade(item, choices, tradePicker, scopePicker, noteInput, save, cancel, status); };
  actions.appendChild(cancel);
  actions.appendChild(save);

  function updateAddSharedTradeSave(){
    save.disabled = !choices[Number(tradePicker.getValue())] || !scopePicker.getScope() || sowSharedItemRemoving;
  }

  if(choices.length){
    panel.appendChild(tradeLabel);
    panel.appendChild(tradePicker.root);
    panel.appendChild(scopeLabel);
    panel.appendChild(scopePicker.root);
    panel.appendChild(noteLabel);
    panel.appendChild(noteInput);
  }
  panel.appendChild(status);
  panel.appendChild(actions);
  panel.addEventListener('click', function(){
    tradePicker.close();
    scopePicker.close();
  });
  modal.appendChild(panel);
  modal.addEventListener('click', function(e){
    if(e.target === modal && !sowSharedItemRemoving) closeAddSharedTrade();
  });
  document.addEventListener('keydown', onAddSharedTradeKey);
  document.body.appendChild(modal);
}

async function saveAddedSharedTrade(item, choices, tradePicker, scopePicker, noteInput, save, cancel, status){
  if(!item || sowSharedItemRemoving) return;
  var trade = choices[Number(tradePicker.getValue())];
  var scope = scopePicker.getScope();
  var note = noteInput.value.trim();
  if(!trade || !scope) return;
  if(!sowProjectJobId){
    window.dispatchEvent(new CustomEvent('sow-needs-project'));
    await sowDialog({
      title: 'Select a project',
      text: 'Select a project before adding a trade.',
      icon: 'warning',
      confirmButtonText: 'OK'
    });
    return;
  }
  var missingId = (item.trades || []).some(function(row){ return !sharedTradeId(row); });
  if(missingId){
    await sowDialog({
      title: 'Cannot add trade',
      text: 'An attached trade is missing its id.',
      icon: 'error',
      confirmButtonText: 'OK'
    });
    return;
  }

  var trades = (item.trades || []).map(function(row){
    return { trade_id: sharedTradeId(row) };
  });
  var added = { trade_id: String(trade.id), scope: scope };
  if(note) added.note = note;
  trades.push(added);

  sowSharedItemRemoving = true;
  save.disabled = true;
  save.classList.add('is-saving');
  save.textContent = '';
  var saveSpin = document.createElement('span');
  saveSpin.className = 'sow-shared-add__spinner';
  saveSpin.setAttribute('aria-hidden', 'true');
  save.appendChild(saveSpin);
  save.appendChild(document.createTextNode('Saving…'));
  cancel.disabled = true;
  tradePicker.setDisabled(true);
  scopePicker.setDisabled(true);
  noteInput.disabled = true;
  if(status) status.hidden = false;
  try {
    if(typeof window.patchSowSharedItem !== 'function'){
      throw new Error('Shared item service is not ready. Please refresh the page.');
    }
    var request = { trades: trades };
    if(Number.isFinite(Number(item.version))) request.expected_version = Number(item.version);
    var response = await window.patchSowSharedItem(sowProjectJobId, item.id, request);
    closeAddSharedTrade();
    applySharedItemPatch(item.id, response);
  } catch(e) {
    await sowDialog({
      title: 'Could not add trade',
      text: e && e.message ? e.message : 'Could not add this trade.',
      icon: 'error',
      confirmButtonText: 'OK'
    });
    save.disabled = false;
    save.classList.remove('is-saving');
    save.textContent = 'Save';
    cancel.disabled = false;
    tradePicker.setDisabled(false);
    scopePicker.setDisabled(!tradePicker.getValue());
    noteInput.disabled = false;
    if(status) status.hidden = true;
  } finally {
    sowSharedItemRemoving = false;
  }
}

// Override showSplitResults to also update shared badge and flag items in trade previews
// Patch showSplitResults to also update shared badge
var _baseSplitResults = showSplitResults;
showSplitResults = function(){
  _baseSplitResults();
  updateSharedCountBadge();
  setWorkbookTabVisible(true);
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
  void runSowDownload('shared', null, el('sow-export-shared-btn'));
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
  'external':    {bg:'#FFF8E6',border:'#C47B00',text:'#C47B00',label:'External'},
  'metalwork':   {bg:'#F0F0F5',border:'#6B7280',text:'#4B5563',label:'Metalwork'},
  'plastering':  {bg:'#EBF7F7',border:'#0D7377',text:'#0D7377',label:'Plastering'},
  'ceilings':    {bg:'#EFF6FC',border:'#0F6CBD',text:'#0F6CBD',label:'Ceilings'},
  'fire_protection':{bg:'#FDF2F2',border:'#C42B1C',text:'#C42B1C',label:'Fire Protection'}
};

function resolveSharedTradeColor(tradeName){
  var preset={
    'Mechanical Services':'var(--teal)',
    'Electrical Services':'var(--blue)',
    'ICT / AV Installations':'var(--purple)',
    'Doors, Shutters & Hatches':'var(--amber)',
    'Doors & Ironmongery':'var(--amber)',
    'Sanitary Appliances':'var(--green)',
    'Sanitaryware & Plumbing':'var(--green)',
    'Metalwork':'#6B7280',
    'Partitions & Linings':'var(--blue)',
    'Glazing & Windows':'var(--purple)'
  };
  if(preset[tradeName]) return preset[tradeName];
  var match=splitTrades.find(function(t){ return t.label === tradeName; });
  if(match && TRADE_COLOURS[match.id]) return TRADE_COLOURS[match.id].border;
  return 'var(--text-mid)';
}

// ── SHARED ITEMS ──────────────────────────────────────────

function isSharedItemRef(ref){
  return SHARED_ITEMS.some(function(item){ return item.ref === ref; });
}

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
function setWorkbookTabVisible(visible){
  var wbTab = el('rtab-workbook');
  if(wbTab) wbTab.style.display = visible ? 'inline-block' : 'none';
}

function switchResultTab(tab){
  ['schedule','trades','shared','compliance','revision','workbook'].forEach(function(t){
    var panel=el('rpanel-'+t),btn=el('rtab-'+t);
    if(!panel||!btn)return;
    var isActive=t===tab;
    panel.style.display=isActive?(t==='trades'||t==='schedule'?'flex':'block'):'none';
    btn.style.cssText='padding:10px 16px;background:transparent;border:none;border-bottom:3px solid '+(isActive?'var(--navy)':'transparent')+';font-size:13px;font-weight:'+(isActive?'700':'500')+';color:'+(isActive?'var(--navy)':'var(--text-light)')+';cursor:pointer;font-family:DM Sans,sans-serif';
  });
  if(tab==='shared')renderSharedItems();
  if(tab==='schedule')renderScheduleView();
  if(tab==='workbook')renderWorkbookPanel();
  if(tab==='revision')renderRevisionPanel();
  if(tab==='compliance')renderComplianceView();
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
var scheduleOverarchingChanges={};
var scheduleApplying=false;

function getSchedulePendingCount(){
  var keys={};
  Object.keys(scheduleChanges).forEach(function(key){ keys[key]=true; });
  Object.keys(scheduleOverarchingChanges).forEach(function(key){ keys[key]=true; });
  return Object.keys(keys).length;
}

function updateScheduleChangeUi(){
  var pending=getSchedulePendingCount();
  var hasPending=pending>0 && !scheduleApplying;
  document.querySelectorAll('[data-schedule-discard]').forEach(function(btn){
    btn.disabled=!hasPending;
  });
  document.querySelectorAll('[data-schedule-apply]').forEach(function(btn){
    btn.disabled=!hasPending;
  });
  var bar=el('schedule-change-bar');
  if(bar){
    bar.style.display=hasPending?'flex':'none';
    var countSpan=bar.querySelector('[data-schedule-pending-count]');
    if(countSpan){
      countSpan.textContent=pending+' change'+(pending===1?'':'s')+' pending';
    }
  }
}

function tradeOverarchingChoices(tradeId){
  var found=null;
  splitTrades.forEach(function(trade){
    if(trade && trade.id===tradeId) found=trade;
  });
  return found && Array.isArray(found.overarching_trades) ? found.overarching_trades.slice() : [];
}

function overarchingAfterTradeChange(newTradeId,currentName,originalTradeId,originalName){
  var choices=tradeOverarchingChoices(newTradeId);
  if(currentName && choices.indexOf(currentName)>=0) return currentName;
  if(newTradeId===originalTradeId && originalName && choices.indexOf(originalName)>=0) return originalName;
  return '';
}

function scheduleSyncRow(itemKey,tradeId,originalTradeId,overarchingName,originalOverarching){
  if(!itemKey) return;
  if(tradeId===originalTradeId) delete scheduleChanges[itemKey];
  else scheduleChanges[itemKey]=tradeId;

  var tradeChanged=tradeId!==originalTradeId;
  var name=overarchingName||'';
  var originalName=originalOverarching||'';
  if(!tradeChanged && (name===originalName || !name)) delete scheduleOverarchingChanges[itemKey];
  else scheduleOverarchingChanges[itemKey]=name;
  updateScheduleChangeUi();
}

function scheduleAllocationPayload(){
  var request={};
  var changes={};
  var overarching={};
  Object.keys(scheduleChanges).forEach(function(key){
    if(scheduleChanges[key]) changes[key]=scheduleChanges[key];
  });
  Object.keys(scheduleOverarchingChanges).forEach(function(key){
    if(scheduleOverarchingChanges[key]) overarching[key]=scheduleOverarchingChanges[key];
  });
  if(Object.keys(changes).length) request.changes=changes;
  if(Object.keys(overarching).length) request.overarching_changes=overarching;
  return request;
}

function fillOverarchingSelect(select,tradeId,selectedName){
  var choices=tradeOverarchingChoices(tradeId);
  var selected=selectedName && choices.indexOf(selectedName)>=0 ? selectedName : '';
  select.innerHTML='';
  if(!choices.length){
    var empty=document.createElement('option');
    empty.value='';
    empty.textContent='-';
    select.appendChild(empty);
    select.value='';
    select.disabled=true;
    select.title='';
    return;
  }
  select.disabled=false;
  if(!selected){
    var placeholder=document.createElement('option');
    placeholder.value='';
    placeholder.textContent='Select';
    placeholder.disabled=true;
    placeholder.selected=true;
    select.appendChild(placeholder);
  }
  choices.forEach(function(choiceName){
    var option=document.createElement('option');
    option.value=choiceName;
    option.textContent=choiceName;
    select.appendChild(option);
  });
  select.value=selected;
  select.title=selected;
}

function scheduleTradeChanged(select){
  var itemKey=select.getAttribute('data-item-key');
  var originalTrade=select.getAttribute('data-original-trade-id')||'';
  var tradeCell=select.parentElement;
  var overarchingCell=tradeCell ? tradeCell.previousElementSibling : null;
  var overarchingSelect=overarchingCell ? overarchingCell.querySelector('select') : null;
  var originalOverarching=overarchingSelect ? (overarchingSelect.getAttribute('data-original-overarching')||'') : '';
  var currentName=overarchingSelect ? overarchingSelect.value : '';
  var nextName=overarchingAfterTradeChange(select.value,currentName,originalTrade,originalOverarching);
  if(overarchingSelect) fillOverarchingSelect(overarchingSelect,select.value,nextName);
  scheduleSyncRow(itemKey,select.value,originalTrade,nextName,originalOverarching);
  var nc=TRADE_COLOURS[select.value]||{text:'#9BA3BF'};
  if(select.previousSibling) select.previousSibling.style.background=nc.text;
  var isU=select.value==='unallocated';
  select.style.borderColor=isU?'var(--red)':'var(--border)';
  select.style.color=isU?'var(--red)':'var(--text)';
  select.style.background=isU?'var(--red-bg)':'#fff';
}

function scheduleOverarchingChanged(select){
  var itemKey=select.getAttribute('data-item-key');
  var originalOverarching=select.getAttribute('data-original-overarching')||'';
  var overarchingCell=select.parentElement;
  var tradeCell=overarchingCell ? overarchingCell.nextElementSibling : null;
  var tradeSelect=tradeCell ? tradeCell.querySelector('select') : null;
  var tradeId=tradeSelect ? tradeSelect.value : '';
  var originalTrade=tradeSelect ? (tradeSelect.getAttribute('data-original-trade-id')||'') : '';
  select.title=select.value;
  scheduleSyncRow(itemKey,tradeId,originalTrade,select.value,originalOverarching);
}

function resetScheduleChanges(){
  if(!getSchedulePendingCount()) return;
  scheduleChanges={};
  scheduleOverarchingChanges={};
  renderScheduleView();
}

function applyAllocationResponse(response){
  if(!applySowSplitResponse({status:response.status||'success',tabs:response.tabs})){
    throw new Error('Allocation update did not return valid split data.');
  }
  scheduleChanges={};
  scheduleOverarchingChanges={};
  updateSplitResultSummary();
  updateSharedCountBadge();
  renderSplitTradeList();
  if(splitActiveTrade) renderSplitPreview(splitActiveTrade);
  renderSharedItems();
  renderScheduleView();
}

async function applyScheduleAllocations(){
  var request=scheduleAllocationPayload();
  var count=getSchedulePendingCount();
  if(!count || scheduleApplying || (!request.changes && !request.overarching_changes)) return;
  if(!sowProjectJobId){
    window.dispatchEvent(new CustomEvent('sow-needs-project'));
    alert('Select a project before applying allocation changes.');
    return;
  }

  scheduleApplying=true;
  updateScheduleChangeUi();
  document.querySelectorAll('[data-schedule-apply]').forEach(function(btn){
    btn.innerHTML='<span style="animation:spin .8s linear infinite;display:inline-block">&#8635;</span> Applying…';
  });

  try {
    if(typeof window.patchSowAllocations!=='function'){
      throw new Error('Allocation API is not available. Please refresh the page.');
    }
    var requestJobId = sowProjectJobId;
    var response=await window.patchSowAllocations(requestJobId,request);
    if(requestJobId !== sowProjectJobId) return;
    applyAllocationResponse(response);
  } catch(e) {
    alert(e && e.message ? e.message : 'Failed to apply allocation changes.');
    updateScheduleChangeUi();
  } finally {
    scheduleApplying=false;
    document.querySelectorAll('[data-schedule-apply]').forEach(function(btn){
      btn.innerHTML='&#10003; Apply Changes';
    });
    updateScheduleChangeUi();
  }
}

function scheduleCellText(value){
  if(value == null) return '-';
  var text = String(value).trim();
  return text ? text : '-';
}

function renderScheduleView(){
  var panel=el('schedule-panel');
  if(!panel)return;
  var keepSheetScroll=sowScheduleSheetScrollLocked;
  sowScheduleSheetScrollLocked=false;
  var existingSheetScroll=panel.querySelector('.schedule-sheet-tabs__scroll');
  if(existingSheetScroll && !keepSheetScroll) sowScheduleSheetScrollLeft=existingSheetScroll.scrollLeft;
  var active = activeScheduleSheet();
  var allItems = active ? active.items.slice() : [];
  if(!allItems.length){
    panel.innerHTML='<div style="padding:40px;text-align:center;color:var(--text-light)">No schedule items available yet. Run AI Trade Split to populate the full schedule.</div>';
    return;
  }
  allItems.sort(function(a,b){return String(a.ref).localeCompare(String(b.ref),undefined,{numeric:true});});
  var tradeOptions=splitTrades.map(function(t){return '<option value="'+escQ(t.id)+'">'+esc(t.label)+'</option>';}).join('');
  var sections={},sectionOrder=[];
  allItems.forEach(function(item){
    if(!sections[item.section]){sections[item.section]=[];sectionOrder.push(item.section);}
    sections[item.section].push(item);
  });
  var unallocCount=allItems.filter(function(i){return i.tradeId==='unallocated';}).length;
  var hasMatchConfidence=allItems.some(function(i){return normalizeMatchConfidence(i.match_confidence);});

  panel.innerHTML='';
  var wrap=document.createElement('div');
  wrap.style.cssText='display:flex;flex-direction:column;height:100%;width:100%;min-width:0;overflow:hidden';

  if(sowScheduleSheets.length){
    var sheetBar=document.createElement('div');
    sheetBar.className='schedule-sheet-tabs';
    var sheetLabel=document.createElement('span');
    sheetLabel.className='schedule-sheet-tabs__label';
    sheetLabel.textContent='Sheet';
    sheetBar.appendChild(sheetLabel);
    var sheetScroll=document.createElement('div');
    sheetScroll.className='schedule-sheet-tabs__scroll';
    sowScheduleSheets.forEach(function(sheetTab){
      var tabBtn=document.createElement('button');
      tabBtn.type='button';
      tabBtn.className='schedule-sheet-tab'+(sheetTab.name===sowActiveScheduleSheet?' is-active':'');
      tabBtn.title=sheetTab.name;
      var name=document.createElement('span');
      name.className='schedule-sheet-tab__name';
      name.textContent=sheetTab.name;
      var count=document.createElement('span');
      count.className='schedule-sheet-tab__count';
      count.textContent=String((sheetTab.items||[]).length);
      tabBtn.appendChild(name);
      tabBtn.appendChild(count);
      tabBtn.onmousedown=function(event){
        event.preventDefault();
        sowScheduleSheetScrollLeft=sheetScroll.scrollLeft;
      };
      tabBtn.onclick=function(){ selectScheduleSheet(sheetTab.name); };
      sheetScroll.appendChild(tabBtn);
    });
    sheetBar.appendChild(sheetLabel);
    var sheetPrev=document.createElement('button');
    sheetPrev.type='button';
    sheetPrev.className='schedule-sheet-tabs__nav';
    sheetPrev.setAttribute('data-sheet-nav','prev');
    sheetPrev.setAttribute('aria-label','Previous sheets');
    sheetPrev.innerHTML='<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M8.5 3L4.5 7l4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var sheetNext=document.createElement('button');
    sheetNext.type='button';
    sheetNext.className='schedule-sheet-tabs__nav';
    sheetNext.setAttribute('data-sheet-nav','next');
    sheetNext.setAttribute('aria-label','Next sheets');
    sheetNext.innerHTML='<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M5.5 3l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    sheetBar.appendChild(sheetPrev);
    sheetBar.appendChild(sheetScroll);
    sheetBar.appendChild(sheetNext);
    wrap.appendChild(sheetBar);
  }

  // Toolbar
  var tb=document.createElement('div');
  tb.className='schedule-toolbar';
  tb.style.cssText='padding:10px 18px;background:var(--white);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-shrink:0';
  tb.innerHTML='<div style="flex:1;min-width:0"><span style="font-size:14px;font-weight:700;color:var(--text)">Full Schedule</span>'+
    '<span style="font-size:12px;color:var(--text-light);margin-left:10px">'+allItems.length+' items &middot; '+sectionOrder.length+' sections'+
    (unallocCount>0?' &middot; <span style="color:var(--red);font-weight:600">'+unallocCount+' unallocated</span>':'')+
    '</span></div>'+
    (hasMatchConfidence
      ? '<div class="schedule-confidence-legend" title="Row colour shows how confident the trade match is">'+
          '<span class="schedule-confidence-legend__label">Match</span>'+
          '<span class="schedule-confidence-legend__item schedule-confidence-legend__item--high">High</span>'+
          '<span class="schedule-confidence-legend__item schedule-confidence-legend__item--medium">Medium</span>'+
          '<span class="schedule-confidence-legend__item schedule-confidence-legend__item--low">Low</span>'+
        '</div>'
      : '')+
    '<div class="schedule-toolbar-hint">Change any dropdown to reassign</div>'+
    '<button class="btn btn-secondary btn-sm" data-schedule-discard disabled onclick="resetScheduleChanges()">Discard</button>'+
    '<button class="btn btn-primary btn-sm" data-schedule-apply style="background:var(--green)" disabled onclick="applyScheduleAllocations()">&#10003; Apply Changes</button>'+
    '<button class="btn btn-secondary btn-sm" id="sow-export-schedule-btn" onclick="exportFullSchedule()">&#8681; Export</button>';
  wrap.appendChild(tb);

  // Spreadsheet — single parent grid keeps header and row columns aligned
  var sheetWrap=document.createElement('div');
  sheetWrap.className='schedule-sheet-wrap';
  var sheet=document.createElement('div');
  sheet.className='schedule-sheet';

  ['','Ref','Description','Qty','Unit','Overarching Trade','Trade Allocation'].forEach(function(h){
    var d=document.createElement('div');
    d.className='schedule-head-cell';
    d.textContent=h;
    sheet.appendChild(d);
  });

  var rowNum=0;
  sectionOrder.forEach(function(sectionName){
    var items=sections[sectionName];
    var secRow=document.createElement('div');
    secRow.className='schedule-section-row';
    secRow.innerHTML='<span style="opacity:.5;font-size:10px">&#9654;</span>'+esc(sectionName)+
      '<span style="font-size:10px;color:rgba(255,255,255,.45);font-weight:400">'+items.length+' item'+(items.length===1?'':'s')+'</span>';
    sheet.appendChild(secRow);

    items.forEach(function(item){
      rowNum++;
      var savedTradeId=item.tradeId;
      var displayTradeId=scheduleChanges[item.item_key]!=null?scheduleChanges[item.item_key]:savedTradeId;
      var savedOverarching=item.overarching_trade||'';
      var hasOverarchingEdit=Object.prototype.hasOwnProperty.call(scheduleOverarchingChanges,item.item_key);
      var displayOverarching=hasOverarchingEdit?scheduleOverarchingChanges[item.item_key]:savedOverarching;
      if(tradeOverarchingChoices(displayTradeId).indexOf(displayOverarching)<0) displayOverarching='';
      var col=TRADE_COLOURS[displayTradeId]||{bg:'#F0F0F5',border:'#9BA3BF',text:'#4A5272'};
      var isUnalloc=displayTradeId==='unallocated';
      var confidence=normalizeMatchConfidence(item.match_confidence);
      var altClass=rowNum%2===0?'':' schedule-cell--alt';
      var confidenceClass=confidence?' schedule-cell--confidence-'+confidence:'';
      var rowClass=altClass+confidenceClass;

      var n=document.createElement('div');
      n.className='schedule-cell schedule-cell--num'+rowClass;
      n.textContent=rowNum;
      if(confidence) n.title='Match confidence: '+confidence.charAt(0).toUpperCase()+confidence.slice(1);
      sheet.appendChild(n);

      var r=document.createElement('div');
      r.className='schedule-cell schedule-cell--ref'+rowClass;
      r.textContent=scheduleCellText(item.ref);
      sheet.appendChild(r);

      var d=document.createElement('div');
      d.className='schedule-cell schedule-cell--desc'+rowClass;
      d.textContent=scheduleCellText(item.desc);
      sheet.appendChild(d);

      var q=document.createElement('div');
      q.className='schedule-cell schedule-cell--qty'+rowClass;
      q.textContent=scheduleCellText(item.qty);
      sheet.appendChild(q);

      var u=document.createElement('div');
      u.className='schedule-cell schedule-cell--unit'+rowClass;
      u.textContent=scheduleCellText(item.unit);
      sheet.appendChild(u);

      var ot=document.createElement('div');
      ot.className='schedule-cell schedule-cell--overarching'+rowClass;
      var otSel=document.createElement('select');
      otSel.className='schedule-trade-select schedule-overarching-select';
      otSel.setAttribute('data-item-key', item.item_key);
      otSel.setAttribute('data-original-overarching', savedOverarching);
      fillOverarchingSelect(otSel, displayTradeId, displayOverarching);
      otSel.onchange=function(){ scheduleOverarchingChanged(this); };
      ot.appendChild(otSel);
      sheet.appendChild(ot);

      var tc=document.createElement('div');
      tc.className='schedule-cell schedule-cell--trade'+rowClass;
      var swatch=document.createElement('div');
      swatch.className='schedule-trade-swatch';
      swatch.style.background=col.text;
      tc.appendChild(swatch);
      var sel=document.createElement('select');
      sel.className='schedule-trade-select';
      sel.setAttribute('data-item-key', item.item_key);
      sel.setAttribute('data-original-trade-id',savedTradeId);
      if(isUnalloc){
        sel.style.borderColor='var(--red)';
        sel.style.color='var(--red)';
        sel.style.background='var(--red-bg)';
      }
      sel.innerHTML=tradeOptions;
      sel.value=displayTradeId;
      sel.onchange=function(){ scheduleTradeChanged(this); };
      tc.appendChild(sel);
      sheet.appendChild(tc);
    });
  });

  sheetWrap.appendChild(sheet);
  sheetWrap.scrollLeft=0;
  wrap.appendChild(sheetWrap);

  // Change bar
  var bar=document.createElement('div');
  bar.id='schedule-change-bar';
  bar.className='schedule-change-bar';
  var pending=getSchedulePendingCount();
  bar.style.cssText='padding:9px 18px;background:var(--amber-bg);border-top:1px solid rgba(196,123,0,.3);flex-shrink:0;display:'+(pending>0?'flex':'none')+';align-items:center;gap:12px';
  bar.innerHTML='<span data-schedule-pending-count style="font-size:13px;font-weight:600;color:var(--amber)">'+pending+' change'+(pending===1?'':'s')+' pending</span>'+
    '<span style="font-size:12px;color:var(--amber)">Changes will update trade documents when applied</span>'+
    '<div style="flex:1"></div>'+
    '<button class="btn btn-secondary btn-sm" data-schedule-discard disabled onclick="resetScheduleChanges()">Discard</button>'+
    '<button class="btn btn-primary btn-sm" data-schedule-apply style="background:var(--green)" disabled onclick="applyScheduleAllocations()">&#10003; Apply Changes</button>';
  wrap.appendChild(bar);
  panel.appendChild(wrap);
  bindScheduleSheetNav(wrap.querySelector('.schedule-sheet-tabs'));
  var sheetScroll=wrap.querySelector('.schedule-sheet-tabs__scroll');
  if(sheetScroll) sheetScroll.scrollLeft=sowScheduleSheetScrollLeft;
  updateScheduleChangeUi();
}

function bindScheduleSheetNav(bar){
  if(!bar) return;
  var scroll=bar.querySelector('.schedule-sheet-tabs__scroll');
  var prev=bar.querySelector('[data-sheet-nav="prev"]');
  var next=bar.querySelector('[data-sheet-nav="next"]');
  if(!scroll || !prev || !next) return;
  function update(){
    var max=scroll.scrollWidth-scroll.clientWidth;
    var overflow=max>4;
    prev.hidden=!overflow;
    next.hidden=!overflow;
    prev.disabled=scroll.scrollLeft<=2;
    next.disabled=scroll.scrollLeft>=max-2;
  }
  function move(direction){
    var amount=Math.max(160, Math.round(scroll.clientWidth*0.72));
    scroll.scrollBy({left:direction*amount, behavior:'smooth'});
  }
  prev.onmousedown=function(event){ event.preventDefault(); };
  next.onmousedown=function(event){ event.preventDefault(); };
  prev.onclick=function(){ move(-1); };
  next.onclick=function(){ move(1); };
  scroll.addEventListener('scroll', function(){
    sowScheduleSheetScrollLeft=scroll.scrollLeft;
    update();
  });
  scroll.addEventListener('wheel', function(event){
    if(scroll.scrollWidth<=scroll.clientWidth+4) return;
    if(Math.abs(event.deltaX)>Math.abs(event.deltaY)) return;
    event.preventDefault();
    scroll.scrollLeft+=event.deltaY;
  }, {passive:false});
  update();
  requestAnimationFrame(update);
}

window.resetScheduleChanges = resetScheduleChanges;
window.applyScheduleAllocations = applyScheduleAllocations;

// ── SUPPORTING FILES (SPEC & DRAWINGS) ───────────────────
var supportingFiles = { spec: [], dwg: [] };
var sowSupportingSpecs = [];
var sowSupportingDrawings = [];
var sowSupportingDocsLoading = false;
var sowSupportingDocsReady = false;
var sowSupportingDocsError = '';
var sowSupportingDocsModalKind = '';

function sowSupportingDocNames(list){
  if(!Array.isArray(list)) return [];
  return list.map(function(item){
    if(typeof item === 'string') return item.trim();
    return item && item.file_name ? String(item.file_name).trim() : '';
  }).filter(Boolean);
}

function sowSupportingDocsForKind(kind){
  return kind === 'drawings' ? sowSupportingDrawings : sowSupportingSpecs;
}

function sowSupportingDocsTitle(kind){
  return kind === 'drawings' ? 'Drawings' : 'Specifications';
}

function closeSowSupportingDocsModal(){
  sowSupportingDocsModalKind = '';
  var modal = document.getElementById('sow-supporting-docs-modal');
  if(modal) modal.remove();
}

function renderSowSupportingDocsModalList(){
  var list = document.getElementById('sow-supporting-docs-modal-list');
  var empty = document.getElementById('sow-supporting-docs-modal-empty');
  var count = document.getElementById('sow-supporting-docs-modal-count');
  var input = document.getElementById('sow-supporting-docs-modal-search');
  if(!list || !sowSupportingDocsModalKind) return;
  var names = sowSupportingDocsForKind(sowSupportingDocsModalKind);
  var query = input && input.value ? input.value.trim().toLowerCase() : '';
  var shown = !query ? names : names.filter(function(name){
    return name.toLowerCase().indexOf(query) !== -1;
  });
  list.innerHTML = shown.map(function(name){
    return '<div class="sow-supporting-modal__item">'+esc(name)+'</div>';
  }).join('');
  list.style.display = shown.length ? 'block' : 'none';
  if(empty){
    empty.style.display = shown.length ? 'none' : 'block';
    empty.textContent = names.length
      ? 'No matching files'
      : (sowSupportingDocsModalKind === 'drawings' ? 'No drawings' : 'No specifications');
  }
  if(count){
    count.textContent = query && shown.length !== names.length
      ? shown.length + ' of ' + names.length
      : names.length + (names.length === 1 ? ' file' : ' files');
  }
}

function openSowSupportingDocsModal(kind){
  if(sowSupportingDocsLoading || !sowSupportingDocsReady) return;
  closeSowSupportingDocsModal();
  sowSupportingDocsModalKind = kind === 'drawings' ? 'drawings' : 'specifications';
  var title = sowSupportingDocsTitle(sowSupportingDocsModalKind);
  var total = sowSupportingDocsForKind(sowSupportingDocsModalKind).length;
  var modal = document.createElement('div');
  modal.id = 'sow-supporting-docs-modal';
  modal.className = 'sow-supporting-modal';
  modal.innerHTML =
    '<div class="sow-supporting-modal__panel" role="dialog" aria-modal="true">'+
      '<div class="sow-supporting-modal__header">'+
        '<div class="sow-supporting-modal__title">'+esc(title)+' ('+total+')</div>'+
        '<button type="button" class="sow-supporting-modal__close" onclick="closeSowSupportingDocsModal()" aria-label="Close">&times;</button>'+
      '</div>'+
      '<div class="sow-supporting-modal__body">'+
        '<input id="sow-supporting-docs-modal-search" class="sow-supporting-modal__search" type="search" placeholder="Search filename" oninput="filterSowSupportingDocsModal()">'+
        '<div id="sow-supporting-docs-modal-count" class="sow-supporting-modal__count"></div>'+
        '<div id="sow-supporting-docs-modal-list" class="sow-supporting-modal__list"></div>'+
        '<div id="sow-supporting-docs-modal-empty" class="sow-supporting-modal__empty" style="display:none"></div>'+
      '</div>'+
    '</div>';
  modal.addEventListener('click', function(event){
    if(event.target === modal) closeSowSupportingDocsModal();
  });
  var host = document.body;
  host.appendChild(modal);
  renderSowSupportingDocsModalList();
  var input = document.getElementById('sow-supporting-docs-modal-search');
  if(input) input.focus();
}

window.openSowSupportingDocsModal = openSowSupportingDocsModal;
window.closeSowSupportingDocsModal = closeSowSupportingDocsModal;
window.filterSowSupportingDocsModal = renderSowSupportingDocsModalList;

function renderSowSupportingDocuments(){
  var root = el('sow-supporting-docs');
  var specBtn = el('sow-supporting-specs-btn');
  var drawingBtn = el('sow-supporting-drawings-btn');
  var message = el('sow-supporting-docs-message');
  if(!root || !specBtn || !drawingBtn || !message) return;

  var visible = sowSupportingDocsLoading || sowSupportingDocsReady || Boolean(sowSupportingDocsError);
  root.style.display = visible ? 'flex' : 'none';
  specBtn.disabled = sowSupportingDocsLoading || !sowSupportingDocsReady;
  drawingBtn.disabled = sowSupportingDocsLoading || !sowSupportingDocsReady;
  specBtn.textContent = sowSupportingDocsLoading
    ? 'Specifications'
    : 'Specifications (' + sowSupportingSpecs.length + ')';
  drawingBtn.textContent = sowSupportingDocsLoading
    ? 'Drawings'
    : 'Drawings (' + sowSupportingDrawings.length + ')';

  if(sowSupportingDocsLoading){
    message.textContent = 'Loading specifications and drawings\u2026';
    message.className = 'sow-supporting-docs__message';
    closeSowSupportingDocsModal();
    return;
  }

  message.textContent = sowSupportingDocsError || '';
  message.className = sowSupportingDocsError
    ? 'sow-supporting-docs__message sow-supporting-docs__message--error'
    : 'sow-supporting-docs__message';

  if(sowSupportingDocsModalKind) renderSowSupportingDocsModalList();

  if(sowSupportingDocsReady && !sowSupportingDocsError &&
    (sowSupportingSpecs.length || sowSupportingDrawings.length)){
    expandSection('sec2');
  }
}

function clearSowSupportingDocuments(){
  sowSupportingSpecs = [];
  sowSupportingDrawings = [];
  sowSupportingDocsLoading = false;
  sowSupportingDocsReady = false;
  sowSupportingDocsError = '';
  closeSowSupportingDocsModal();
  renderSowSupportingDocuments();
}

window.clearSowSupportingDocuments = clearSowSupportingDocuments;

window.setSowSupportingDocumentsLoading = function(loading){
  sowSupportingDocsLoading = Boolean(loading);
  if(sowSupportingDocsLoading){
    sowSupportingSpecs = [];
    sowSupportingDrawings = [];
    sowSupportingDocsReady = false;
    sowSupportingDocsError = '';
  }
  renderSowSupportingDocuments();
  updateSec2Status();
};

window.setSowSupportingDocuments = function(payload){
  var data = payload || {};
  sowSupportingDocsLoading = false;
  sowSupportingDocsReady = true;
  sowSupportingDocsError = data.error ? String(data.error) : '';
  sowSupportingSpecs = sowSupportingDocNames(data.specifications);
  sowSupportingDrawings = sowSupportingDocNames(data.drawings);
  renderSowSupportingDocuments();
  updateSec2Status();
};

function supportingFileExtension(file){
  var name = file && file.name ? String(file.name) : '';
  var dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function supportingFileAllowed(file, type){
  var ext = supportingFileExtension(file);
  if(type === 'dwg') return ext === 'pdf';
  return ext === 'pdf' || ext === 'docx';
}

function supportingFileRuleText(type){
  return type === 'dwg'
    ? 'Drawing schedules accept PDF files only.'
    : 'Specification sections accept PDF and Word (.docx) files only.';
}

function addSupportingFiles(files, type, input){
  var accepted = [];
  var rejected = [];
  Array.from(files || []).forEach(function(file){
    if(supportingFileAllowed(file, type)) accepted.push(file);
    else rejected.push(file && file.name ? file.name : 'file');
  });
  accepted.forEach(function(file){ addSupportingFile(file, type); });
  if(input) input.value = '';
  if(!rejected.length) return;
  var names = rejected.slice(0, 3).join(', ');
  if(rejected.length > 3) names += ' and ' + (rejected.length - 3) + ' more';
  sowDialog({
    title: 'File not added',
    text: names + '. ' + supportingFileRuleText(type),
    icon: 'warning',
    confirmButtonText: 'OK',
    confirmButtonColor: 'hsl(262 83% 58%)'
  });
}

function specHandleFile(event, type) {
  addSupportingFiles(event.target.files, type, event.target);
}
function specHandleDrop(event, type) {
  event.preventDefault();
  var dz = el(type+'-drop-zone');
  if(dz){ dz.style.borderColor='var(--border)'; dz.style.background='var(--bg)'; }
  addSupportingFiles(event.dataTransfer.files, type);
}
function addSupportingFile(f, type) {
  supportingFiles[type].push(f);
  renderSupportingFilesList();
  updateCheckBtn();
  updateSec2Status();
}
function removeSupportingFile(type, idx) {
  supportingFiles[type].splice(idx, 1);
  renderSupportingFilesList();
  updateCheckBtn();
  updateSec2Status();
}
function updateSec2Status() {
  var statusEl = el('sec2-status');
  var numEl = el('sec2-num');
  if(!statusEl || !numEl) return;
  var uploaded = supportingFiles.spec.length + supportingFiles.dwg.length;
  var fromProject = sowSupportingSpecs.length + sowSupportingDrawings.length;
  var total = uploaded + fromProject;
  if(sowSupportingDocsLoading && !total){
    statusEl.textContent = 'Loading\u2026';
    numEl.className = 'section-num optional';
    return;
  }
  if(total > 0){
    statusEl.textContent = total + ' file' + (total===1?'':'s');
    numEl.className = 'section-num done';
  } else {
    statusEl.textContent = 'optional';
    numEl.className = 'section-num optional';
  }
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

// ── BACKEND COMPLIANCE ADAPTER ────────────────────────────
// Maps tabs.compliance from the split API response into the engine's
// complianceResults shape so renderCompliancePanel() renders real backend data.
// The engine's own Section-2 file-upload flow (runComplianceCheck) is kept
// unchanged below — this is an additional path, not a replacement.
function _adaptBackendCompliance(bc) {
  if (!bc || typeof bc !== 'object') return null;
  var summary = bc.summary || {};
  var byType  = bc.by_type  || {};

  function mapIssue(iss) {
    var label  = iss.nbs_code ? '[' + iss.nbs_code + '] ' + (iss.work_type || '') : (iss.work_type || '');
    var clause = iss.item || iss.clause || '';
    return {
      name:           label + (clause ? ' — ' + clause : ''),
      description:    iss.description || '',
      severity:       (iss.severity || 'medium').toLowerCase(),
      recommendation: ''
    };
  }

  var missingFromSow = (byType.missing_from_sow  || []).map(mapIssue);
  var orphanedInSow  = (byType.missing_from_spec || []).map(mapIssue);

  return {
    summary: {
      sowItems:        summary.specs_checked    || 0,
      specSections:    summary.specs_checked    || 0,
      drawingRefs:     0,
      missingFromSow:  summary.missing_from_sow  || missingFromSow.length,
      orphanedInSow:   summary.missing_from_spec || orphanedInSow.length,
      crossReferenced: 0
    },
    missingFromSow:  missingFromSow,
    orphanedInSow:   orphanedInSow,
    crossReferenced: []
  };
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
  var compliancePanel = el('compliance-panel');
  if(compliancePanel){
    removeComplianceTransient();
    var complianceExample = el('compliance-example');
    if(complianceExample) complianceExample.style.display = 'none';
    var loadDiv = document.createElement('div');
    loadDiv.id = 'compliance-loading';
    loadDiv.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-light)">'+
      '<div style="font-size:32px;margin-bottom:12px;animation:spin 1s linear infinite;display:inline-block">&#8635;</div>'+
      '<div style="font-size:14px;font-weight:600;margin-bottom:6px">AI is cross-referencing documents...</div>'+
      '<div style="font-size:12.5px;color:var(--text-hint)">Comparing schedule of works against specification and drawing registers</div>'+
      '</div>';
    compliancePanel.appendChild(loadDiv);
  }

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
    var errPanel = el('compliance-panel');
    if(errPanel){
      removeComplianceTransient();
      var errDiv = document.createElement('div');
      errDiv.id = 'compliance-empty-state';
      errDiv.innerHTML = '<div style="padding:32px;background:var(--red-bg);border:1px solid rgba(196,43,28,.2);border-radius:8px;color:var(--red)">'+
        '<strong>Check failed:</strong> '+esc(e.message)+'. Please ensure your documents are readable and try again.</div>';
      errPanel.appendChild(errDiv);
    }
  }

  btn.disabled = false;
  btn.innerHTML = '&#128269; Check for Gaps &amp; Missing Items';
  updateCheckBtn();
}

function renderComplianceView(){
  var panel = el('compliance-panel');
  if(!panel) return;
  if(complianceResults){
    removeComplianceTransient();
    renderCompliancePanel();
    return;
  }
  removeComplianceTransient();
  var ex = el('compliance-example');
  if(splitTrades.length){
    if(ex) ex.style.display = 'none';
    var wrap = document.createElement('div');
    wrap.id = 'compliance-empty-state';
    wrap.innerHTML = sowTabEmptyStateHtml(
      '&#128203;',
      'No compliance records found',
      'No compliance check results were returned for this project. Upload specification and drawing schedules in Section 2 and run a live check, or re-run AI Trade Split if compliance should be included automatically.'
    );
    panel.appendChild(wrap);
    return;
  }
  if(ex){
    ex.style.display = 'block';
  } else {
    var fallback = document.createElement('div');
    fallback.id = 'compliance-empty-state';
    fallback.innerHTML = sowTabEmptyStateHtml(
      '&#128203;',
      'No compliance data yet',
      'Run AI Trade Split for this project, then use Section 2 to upload supporting documents and run a compliance check.'
    );
    panel.appendChild(fallback);
  }
}

function renderCompliancePanel() {
  var panel = el('compliance-panel');
  if(!panel || !complianceResults) return;
  removeComplianceTransient();
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
// ── CREATE WORKBOOK ───────────────────────────────────────
var wbTemplateFile_ = null;

function ensureWbTemplateErrorEl(){
  var errEl = el('wb-template-error');
  if(errEl) return errEl;
  var areaEl = el('wb-template-area');
  if(!areaEl || !areaEl.parentNode) return null;
  errEl = document.createElement('div');
  errEl.id = 'wb-template-error';
  areaEl.parentNode.insertBefore(errEl, areaEl.nextSibling);
  return errEl;
}

function resetWbTemplateDropZoneStyle(){
  var dropZone = el('wb-template-drop-zone');
  if(!dropZone) return;
  dropZone.classList.remove('wb-template-drop-error');
}

function markWbTemplateDropZoneError(){
  var dropZone = el('wb-template-drop-zone');
  if(!dropZone) return;
  dropZone.classList.add('wb-template-drop-error');
}

function showWbTemplateError(message){
  var errEl = ensureWbTemplateErrorEl();
  if(!errEl) return;
  errEl.innerHTML = '&#10007; '+esc(message || 'Invalid template file.');
  errEl.style.display = 'block';
  markWbTemplateDropZoneError();
}

function clearWbTemplateError(){
  var errEl = el('wb-template-error');
  if(errEl){
    errEl.textContent = '';
    errEl.style.display = 'none';
  }
  resetWbTemplateDropZoneStyle();
}

function validateWbTemplateFileLocal(f){
  if(!f) return 'Template file is required.';
  var name = (f.name || '').trim();
  if(!name) return 'Template file name is missing.';
  var dot = name.lastIndexOf('.');
  var ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';
  if(ext !== '.xlsx') return 'Template must be an Excel workbook (.xlsx).';
  if(!f.size) return 'Template file is empty.';
  if(f.size > 25 * 1024 * 1024) return 'Template file is too large (max 25 MB).';
  var mime = (f.type || '').toLowerCase();
  if(mime && mime !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && mime !== 'application/octet-stream' && mime !== 'application/zip'){
    return 'Template must be a valid .xlsx Excel file.';
  }
  return null;
}

async function validateWbTemplateFile(f){
  var localError = validateWbTemplateFileLocal(f);
  if(localError) throw new Error(localError);
  if(f.size < 4) throw new Error('Template file is not a valid .xlsx workbook.');
  var header = new Uint8Array(await f.slice(0, 4).arrayBuffer());
  if(header[0] !== 0x50 || header[1] !== 0x4b){
    throw new Error('Template file does not appear to be a valid .xlsx workbook.');
  }
  if(typeof window.validateSowWorkbookTemplate === 'function'){
    await window.validateSowWorkbookTemplate(f);
  }
}

function rejectWbTemplate(message){
  wbTemplateFile_ = null;
  var inputEl = el('wb-template-input');
  var pillEl = el('wb-template-pill');
  var areaEl = el('wb-template-area');
  if(inputEl) inputEl.value = '';
  if(pillEl) pillEl.style.display = 'none';
  if(areaEl) areaEl.style.display = 'block';
  showWbTemplateError(message);
}

function wbTemplateFile(event){
  var input = event && event.target;
  var f = input && input.files && input.files[0];
  if(f) void setWbTemplate(f);
  else if(input) input.value = '';
}
function wbTemplateDrop(event){
  event.preventDefault();
  event.stopPropagation();
  resetWbTemplateDropZoneStyle();
  var files = event.dataTransfer && event.dataTransfer.files;
  var f = files && files[0];
  if(!f){
    showWbTemplateError('No file was dropped.');
    return;
  }
  if(files.length > 1){
    showWbTemplateError('Please drop only one template file.');
    return;
  }
  void setWbTemplate(f);
}
async function setWbTemplate(f){
  clearWbTemplateError();
  try {
    await validateWbTemplateFile(f);
  } catch(e) {
    rejectWbTemplate(e && e.message ? e.message : 'Invalid template file.');
    return;
  }
  wbTemplateFile_ = f;
  var nameEl = el('wb-template-name');
  var pillEl = el('wb-template-pill');
  var areaEl = el('wb-template-area');
  if(nameEl) nameEl.textContent = f.name;
  if(pillEl) pillEl.style.display = 'block';
  if(areaEl) areaEl.style.display = 'none';
}
function clearWbTemplate(){
  wbTemplateFile_ = null;
  clearWbTemplateError();
  var pillEl = el('wb-template-pill');
  var areaEl = el('wb-template-area');
  var inputEl = el('wb-template-input');
  if(pillEl) pillEl.style.display = 'none';
  if(areaEl) areaEl.style.display = 'block';
  if(inputEl) inputEl.value = '';
}

function initWorkbookTemplateControls(){
  var areaEl = el('wb-template-area');
  var inputEl = el('wb-template-input');
  var dropZone = el('wb-template-drop-zone');
  var changeBtn = el('wb-template-change');
  if(!areaEl || !inputEl || !dropZone) return;
  if(areaEl.dataset.sowWbBound === '1') return;
  areaEl.dataset.sowWbBound = '1';

  dropZone.addEventListener('click', function(){
    inputEl.click();
  });
  inputEl.addEventListener('change', wbTemplateFile);
  dropZone.addEventListener('dragover', function(event){
    event.preventDefault();
    dropZone.classList.remove('wb-template-drop-error');
    dropZone.style.borderColor = 'var(--green)';
    dropZone.style.background = 'var(--green-bg)';
  });
  dropZone.addEventListener('dragleave', function(event){
    event.preventDefault();
    if(!dropZone.classList.contains('wb-template-drop-error')){
      dropZone.style.borderColor = '';
      dropZone.style.background = '';
    }
  });
  dropZone.addEventListener('drop', wbTemplateDrop);
  if(changeBtn) changeBtn.addEventListener('click', clearWbTemplate);
}

window.wbTemplateFile = wbTemplateFile;
window.wbTemplateDrop = wbTemplateDrop;
window.clearWbTemplate = clearWbTemplate;

function renderWorkbookPanel(){
  var listEl = el('wb-trades-list');
  if(listEl){
    var trades = splitTrades.filter(function(t){ return t.id !== 'unallocated'; });
    listEl.innerHTML = trades.map(function(t){
      var col = TRADE_COLOURS[t.id]||{bg:'#F0F0F5',text:'#4A5272'};
      var count = t.lineCount != null ? t.lineCount : (t.items || []).length;
      return '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;background:'+col.bg+';color:'+col.text+';border:1px solid '+col.text+'22">'+
        esc(t.label)+
        '<span style="font-size:10.5px;opacity:.7">'+count+'</span>'+
      '</span>';
    }).join('');
  }
  var compCount = el('wb-comp-count');
  if(compCount){
    var n = splitTrades.filter(function(t){ return t.id !== 'unallocated'; }).length;
    compCount.textContent = n+' tab'+(n===1?'':'s');
  }
  var psumsCount = el('wb-psums-count');
  if(psumsCount){
    var psCount = 0;
    splitTrades.forEach(function(t){
      (t.items||[]).forEach(function(item){
        if(item.desc && item.desc.toLowerCase().indexOf('provisional sum') > -1) psCount++;
      });
    });
    psumsCount.textContent = psCount > 0 ? psCount+' item'+(psCount===1?'':'s')+' found' : 'P.SUMS tab';
  }
}

function buildWorkbookIncludeSelection(){
  var keys = ['wb-include-summary','wb-include-sow','wb-include-comps','wb-include-psums','wb-include-sc','wb-include-links'];
  var checked = keys.filter(function(id){
    var cb = el(id);
    return cb && cb.checked;
  });
  if(!checked.length) return null;
  if(checked.length === keys.length) return undefined;
  return checked;
}

function triggerWorkbookDownload(blob, filename){
  triggerSowFileDownload(blob, filename);
}

async function runCreateWorkbook(){
  if(!splitTrades.length){
    alert('Run the AI Trade Split first to generate trade documents.');
    return;
  }
  if(!sowProjectJobId){
    window.dispatchEvent(new CustomEvent('sow-needs-project'));
    alert('Select a project before creating the workbook.');
    return;
  }
  var include = buildWorkbookIncludeSelection();
  if(include === null){
    var statusEmpty = el('wb-status');
    if(statusEmpty) statusEmpty.innerHTML = '<span style="color:var(--red)">&#10007; Select at least one workbook section to include.</span>';
    return;
  }
  if(!wbTemplateFile_){
    var statusTpl = el('wb-status');
    if(statusTpl) statusTpl.innerHTML = '<span style="color:var(--red)">&#10007; Please upload a DCK Tender Workbook template (.xlsx).</span>';
    showWbTemplateError('Please upload a DCK Tender Workbook template (.xlsx) before creating the workbook.');
    var areaEl = el('wb-template-area');
    if(areaEl) areaEl.style.display = 'block';
    var pillEl = el('wb-template-pill');
    if(pillEl) pillEl.style.display = 'none';
    return;
  }
  var btn = el('wb-create-btn');
  var status = el('wb-status');
  if(!btn) return;
  btn.disabled = true;
  btn.innerHTML = '<span style="animation:spin .8s linear infinite;display:inline-block">&#8635;</span> Building workbook…';
  if(status) status.textContent = '';

  try {
    if(typeof window.submitSowWorkbook !== 'function'){
      throw new Error('Workbook API is not available. Please refresh the page.');
    }
    await validateWbTemplateFile(wbTemplateFile_);
    if(status) status.textContent = 'Generating workbook…';
    var request = { include: include, template: wbTemplateFile_ };
    var result = await window.submitSowWorkbook(sowProjectJobId, request);
    triggerWorkbookDownload(result.blob, result.filename);
    btn.disabled = false;
    btn.innerHTML = '<span>&#128202;</span> Create &amp; Download Tender Workbook';
    if(status) status.innerHTML = '<span style="color:var(--green)">&#10003; Workbook downloaded</span>';
  } catch(e) {
    btn.disabled = false;
    btn.innerHTML = '<span>&#128202;</span> Create &amp; Download Tender Workbook';
    if(status) status.innerHTML = '<span style="color:var(--red)">&#10007; '+esc(e && e.message ? e.message : 'Workbook generation failed')+'</span>';
  }
}
window.downloadAllExcel = downloadAllExcel;
window.downloadTradeExcel = downloadTradeExcel;
window.exportSharedItems = exportSharedItems;
window.exportFullSchedule = exportFullSchedule;
window.runCreateWorkbook = runCreateWorkbook;

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
  var source = getSowSplitSource();
  btn.disabled = !(revFile && splitTrades.length > 0 && source && sowProjectJobId);
}

async function runRevisionCompare(){
  if(!revFile){
    alert('Please upload a revised schedule first.');
    return;
  }
  if(!splitTrades.length){
    alert('Run the AI Trade Split first so there is a current schedule to compare against.');
    return;
  }
  if(!sowProjectJobId){
    window.dispatchEvent(new CustomEvent('sow-needs-project'));
    alert('Select a project before comparing revisions.');
    return;
  }
  var source = getSowSplitSource();
  if(!source){
    alert('Please ensure the original schedule source is still available in Step 1.');
    return;
  }
  if(!sowSheetsReadyForRun()) return;

  var btn = el('rev-compare-btn');
  btn.disabled = true;
  btn.innerHTML = '<span style="animation:spin .8s linear infinite;display:inline-block">&#8635;</span> Comparing...';

  el('split-empty').style.display = 'none';
  el('split-results').style.display = 'flex';
  switchResultTab('revision');
  var revEx = el('revision-example');
  if(revEx) revEx.style.display = 'none';
  var prevLive = el('revision-panel').querySelector('#revision-live-results');
  if(prevLive) prevLive.remove();
  var loadDiv = document.createElement('div');
  loadDiv.id = 'revision-live-results';
  loadDiv.innerHTML =
    '<div style="padding:40px;text-align:center;color:var(--text-light)">'+
    '<div style="font-size:32px;margin-bottom:12px;animation:spin 1s linear infinite;display:inline-block">&#8635;</div>'+
    '<div style="font-size:14px;font-weight:600;margin-bottom:6px">Comparing revisions...</div>'+
    '<div style="font-size:12.5px;color:var(--text-hint)">Identifying new, amended and deleted items against the current schedule</div>'+
    '</div>';
  el('revision-panel').appendChild(loadDiv);

  try {
    if(typeof window.submitSowSplit !== 'function'){
      throw new Error('Split service is not ready. Please refresh the page.');
    }
    var request = buildSplitRequest(source);
    request.revised_file = revFile;
    var response = await window.submitSowSplit(sowProjectJobId, request);
    if(!applySowSplitResponse(response)){
      throw new Error('Revision compare did not return trade documents.');
    }
    updateSplitResultSummary();
    renderSplitTradeList();
    if(splitActiveTrade) renderSplitPreview(splitActiveTrade);
    updateSharedCountBadge();
    setWorkbookTabVisible(true);
    renderRevisionPanel();
    switchResultTab('revision');
  } catch(e) {
    var errPrev = el('revision-panel').querySelector('#revision-live-results');
    if(errPrev) errPrev.remove();
    var errDiv2 = document.createElement('div');
    errDiv2.id = 'revision-live-results';
    errDiv2.innerHTML = '<div style="padding:32px;background:var(--red-bg);border:1px solid rgba(196,43,28,.2);border-radius:8px;color:var(--red)"><strong>Comparison failed:</strong> '+esc(e && e.message ? e.message : 'Please try again.')+'</div>';
    el('revision-panel').appendChild(errDiv2);
  }

  btn.disabled = false;
  btn.innerHTML = '&#128260; Compare &amp; Update Trade Documents';
  updateRevBtn();
}

function revisionQtyDelta(oldQty, newQty){
  var o = parseFloat(oldQty);
  var n = parseFloat(newQty);
  if(isNaN(o) || isNaN(n) || o === n) return '';
  var d = n - o;
  return (d > 0 ? '+' : '') + (Number.isInteger(d) ? d : d.toFixed(2));
}

function revisionQtySummary(change){
  var parts = [];
  if(change.currentQty != null && change.currentQty !== ''){
    parts.push(String(change.currentQty) + (change.currentUnit ? ' '+change.currentUnit : ''));
  }
  if(change.revisedQty != null && change.revisedQty !== ''){
    parts.push(String(change.revisedQty) + (change.revisedUnit ? ' '+change.revisedUnit : ''));
  }
  if(parts.length === 2) return parts[0] + ' \u2192 ' + parts[1];
  return parts.join(' ');
}


function renderRevisionPanel(){
  var panel = el('revision-panel');
  if(!panel) return;
  var ex = el('revision-example');
  if(!revisionResults){
    var emptyPrev = panel.querySelector('#revision-live-results');
    if(emptyPrev) emptyPrev.remove();
    var emptyState = panel.querySelector('#revision-empty-state');
    if(emptyState) emptyState.remove();
    if(splitTrades.length){
      if(ex) ex.style.display = 'none';
      var wrap = document.createElement('div');
      wrap.id = 'revision-empty-state';
      wrap.innerHTML = sowTabEmptyStateHtml(
        '&#128260;',
        'No revision comparison available',
        'No revision diff was returned for this project. Upload a revised schedule in Section 3 and run a comparison, or re-run AI Trade Split if a revision should be included automatically.'
      );
      panel.appendChild(wrap);
    } else if(ex){
      ex.style.display = 'block';
    }
    return;
  }
  var emptyState = panel.querySelector('#revision-empty-state');
  if(emptyState) emptyState.remove();
  if(ex) ex.style.display = 'none';

  var r = revisionResults;
  var s = r.summary || {};
  var changes = r.changes || [];
  var newCount = s.new != null ? s.new : changes.filter(function(c){return c.changeType==='new';}).length;
  var amendedCount = s.amended != null ? s.amended : changes.filter(function(c){return c.changeType==='amended';}).length;
  var deletedCount = s.deleted != null ? s.deleted : changes.filter(function(c){return c.changeType==='deleted';}).length;
  var unchangedCount = s.unchanged != null ? s.unchanged : changes.filter(function(c){return c.changeType==='unchanged';}).length;

  var newItems = changes.filter(function(c){return c.changeType==='new';});
  var amendedItems = changes.filter(function(c){return c.changeType==='amended';});
  var deletedItems = changes.filter(function(c){return c.changeType==='deleted';});

  var titleText = r.revisionTitle || (r.revisionRef ? 'Revision '+r.revisionRef : 'Revision Comparison');
  var html = '';

  html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:8px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">'+
    '<div style="font-size:28px;line-height:1">&#128260;</div>'+
    '<div style="flex:1;min-width:200px">'+
      '<div style="font-size:16px;font-weight:700;color:var(--text)">'+esc(titleText)+'</div>'+
      '<div style="font-size:12.5px;color:var(--text-light);margin-top:4px;line-height:1.5">Trade documents have been automatically updated from the revised schedule. Review the changes below.</div>'+
    '</div>'+
    (r.revisionDate ? '<span style="background:var(--purple-bg);color:var(--purple);border:1px solid rgba(91,61,168,.2);padding:4px 12px;border-radius:12px;font-size:11.5px;font-weight:700;white-space:nowrap">'+esc(r.revisionRef || 'Rev')+' issued '+esc(r.revisionDate)+'</span>' : '')+
    '<button class="btn btn-secondary btn-sm" onclick="downloadRevisionReport()">&#8681; Export Report</button>'+
  '</div>';

  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px">';
  [
    {label:'New Items', count:newCount, color:'var(--green)', bg:'var(--green-bg)', prefix:'+'},
    {label:'Amended', count:amendedCount, color:'var(--amber)', bg:'var(--amber-bg)', prefix:''},
    {label:'Deleted', count:deletedCount, color:'var(--red)', bg:'var(--red-bg)', prefix:'\u2212'},
    {label:'Unchanged', count:unchangedCount, color:'var(--text-hint)', bg:'var(--bg)', prefix:'\u2248'}
  ].forEach(function(c){
    html += '<div style="background:'+c.bg+';border:1px solid '+c.color+'33;border-radius:8px;padding:14px 12px;text-align:center">'+
      '<div style="font-size:24px;font-weight:800;color:'+c.color+';line-height:1.1">'+(c.prefix ? c.prefix+' ' : '')+c.count+'</div>'+
      '<div style="font-size:11px;color:'+c.color+';font-weight:600;margin-top:4px">'+c.label+'</div>'+
    '</div>';
  });
  html += '</div>';

  function renderChangeBadge(change, borderColor, bgColor){
    var label = change.changeTypeLabel || change.changeNotes || '';
    if(!label){
      if(change.changeType === 'new') label = 'New item';
      else if(change.changeType === 'deleted') label = 'Deleted';
      else if(change.changeType === 'amended') label = 'Amended';
    }
    return '<span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:10px;background:'+bgColor+';color:'+borderColor+';border:1px solid '+borderColor+'44;display:inline-flex;align-items:center;gap:4px">'+
      (change.changeType === 'amended' ? '&#9998; ' : '')+esc(label)+
    '</span>';
  }

  function renderGroup(items, type, label, borderColor, bgColor){
    if(!items.length) return '';
    var out = '<div style="margin-bottom:22px">';
    out += '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">'+
      '<span style="background:'+bgColor+';color:'+borderColor+';border:1px solid '+borderColor+'44;padding:2px 9px;border-radius:10px;font-size:11px;font-weight:700">'+esc(label)+'</span>'+
      '<span style="font-size:12px;font-weight:400;color:var(--text-light)">'+items.length+' item'+(items.length===1?'':'s')+' changed</span>'+
    '</div>';

    items.forEach(function(change){
      var meta = [];
      if(change.tradeLabel || change.tradeId) meta.push(esc(change.tradeLabel || change.tradeId));
      if(change.section) meta.push(esc(change.section));
      var qtyLine = revisionQtySummary(change);
      var delta = revisionQtyDelta(change.currentQty, change.revisedQty);

      out += '<div style="background:var(--white);border:1px solid var(--border);border-left:4px solid '+borderColor+';border-radius:6px;margin-bottom:10px;overflow:hidden">';

      out += '<div style="padding:10px 14px;display:flex;align-items:flex-start;gap:10px;background:'+bgColor+'18;flex-wrap:wrap">'+
        '<span style="font-size:11px;font-weight:700;color:var(--navy);background:#fff;border:1px solid var(--border);padding:2px 7px;border-radius:4px;flex-shrink:0">'+esc(change.ref||'\u2014')+'</span>'+
        '<div style="flex:1;min-width:180px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">'+
          renderChangeBadge(change, borderColor, bgColor)+
          (meta.length ? '<span style="font-size:11px;color:var(--text-hint)">'+meta.join(' \u00b7 ')+'</span>' : '')+
        '</div>'+
        (qtyLine ? '<span style="font-size:11.5px;font-weight:600;color:'+borderColor+';white-space:nowrap">'+esc(qtyLine)+'</span>' : '')+
      '</div>';

      if(type === 'new'){
        out += '<div style="padding:12px 14px">'+
          '<div style="font-size:12.5px;color:var(--text);line-height:1.5">'+esc(change.revisedDesc||'')+'</div>'+
          (change.revisedQty != null && change.revisedQty !== '' ? '<div style="display:inline-block;margin-top:8px;padding:4px 10px;border-radius:4px;background:var(--green-bg);border:1px solid rgba(16,124,16,.25);font-size:11.5px;font-weight:700;color:var(--green)">'+esc(change.revisedQty)+' '+esc(change.revisedUnit||'')+'</div>' : '')+
        '</div>';
      } else if(type === 'deleted'){
        out += '<div style="padding:12px 14px">'+
          '<div style="font-size:12.5px;color:var(--text-hint);text-decoration:line-through;line-height:1.5">'+esc(change.currentDesc||'')+'</div>'+
          (change.currentQty != null && change.currentQty !== '' ? '<div style="display:inline-block;margin-top:8px;padding:4px 10px;border-radius:4px;background:var(--red-bg);border:1px solid rgba(196,43,28,.25);font-size:11.5px;font-weight:700;color:var(--red);text-decoration:line-through">'+esc(change.currentQty)+' '+esc(change.currentUnit||'')+'</div>' : '')+
        '</div>';
      } else if(type === 'amended'){
        out += '<div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--border)">';
        out += '<div style="padding:12px 14px;border-right:1px solid var(--border);background:#FFF8F0">'+
          '<div style="font-size:10px;font-weight:700;color:#C47B00;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Rev A \u2014 Original</div>'+
          '<div style="font-size:12px;color:var(--text);line-height:1.5">'+esc(change.currentDesc||'\u2014')+'</div>'+
          (change.currentQty != null && change.currentQty !== '' ? '<div style="display:inline-block;margin-top:10px;padding:5px 12px;border-radius:4px;background:#fff;border:1.5px solid #C47B00;font-size:12px;font-weight:700;color:#C47B00">'+esc(change.currentQty)+' '+esc(change.currentUnit||'')+'</div>' : '')+
        '</div>';
        out += '<div style="padding:12px 14px;background:#F2FAF2">'+
          '<div style="font-size:10px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Rev B \u2014 Revised</div>'+
          '<div style="font-size:12px;color:var(--text);line-height:1.5">'+esc(change.revisedDesc||'\u2014')+'</div>'+
          (change.revisedQty != null && change.revisedQty !== '' ? '<div style="display:inline-block;margin-top:10px;padding:5px 12px;border-radius:4px;background:#fff;border:1.5px solid var(--green);font-size:12px;font-weight:700;color:var(--green)">'+esc(change.revisedQty)+' '+esc(change.revisedUnit||'')+(delta ? ' <span style="opacity:.85">'+esc(delta)+'</span>' : '')+'</div>' : '')+
        '</div>';
        out += '</div>';
      }

      out += '</div>';
    });
    out += '</div>';
    return out;
  }

  if(newItems.length) html += renderGroup(newItems, 'new', 'New', 'var(--green)', 'var(--green-bg)');
  if(amendedItems.length) html += renderGroup(amendedItems, 'amended', 'Amended', 'var(--amber)', 'var(--amber-bg)');
  if(deletedItems.length) html += renderGroup(deletedItems, 'deleted', 'Deleted', 'var(--red)', 'var(--red-bg)');

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
  clearWbTemplate();
  renderSupportingFilesList();
  updateCheckBtn();
  updateSec2Status();
  // Clear compliance badge and panel — restore empty/example state
  var badge = el('compliance-count-badge');
  if(badge){ badge.style.display='none'; }
  renderComplianceView();
  // Clear revision state — restore example
  clearRevFile();
  clearRevisionResults();
  var revbtn = el('rev-compare-btn'); if(revbtn) revbtn.disabled=true;
};

updateSplitRunBtnState();
renderSowTradeSplitForm();

window.refreshSowEngineDom = function(){
  renderSowTradeSplitForm();
  updateSplitRunBtnState();
  renderSowFoundFilesList();
  updateSowEmsSectionStatus();
  renderSowSupportingDocuments();
  updateSec2Status();
  initWorkbookTemplateControls();
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
