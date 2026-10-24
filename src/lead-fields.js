import {pricing,monthlyServices} from './pricing-data.js';
export const enquiryServices=[...[...pricing,...monthlyServices].map(item=>({id:item.id,label:item.name+(item.detail?` · ${item.detail.split(' · ')[0]}`:'')})),{id:'other',label:'Something else / Let’s discuss'}];
export const enquiryFields=['name','phone','email','requirement','message'];
export const emptyEnquiry={name:'',phone:'',email:'',requirement:'',message:''};
export const requirementLabel=id=>enquiryServices.find(item=>item.id===id)?.label||'Project enquiry';
export function enquiryFieldError(key,value){
  if(typeof value!=='string')return 'Use a text value.';
  if(key==='name'&&(value.length<2||value.length>100||/[\x00-\x1f]/.test(value)))return 'Enter your name (2–100 characters).';
  if(key==='phone'&&(!/^[+\d() .-]{7,25}$/.test(value)||value.replace(/\D/g,'').length<7||value.replace(/\D/g,'').length>15))return 'Enter a valid phone number, including the country code.';
  if(key==='email'&&(value.length>254||!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(value)))return 'Enter a valid email address.';
  if(key==='requirement'&&!enquiryServices.some(item=>item.id===value))return 'Choose what I can help with.';
  if(key==='message'&&(value.length<10||value.length>4000||value.includes('\0')))return 'Describe your project in 10–4,000 characters.';
  return null;
}
export function cleanEnquiryPatch(input){
  if(!input||typeof input!=='object'||Array.isArray(input))return {patch:{},errors:{draft:'Provide enquiry fields as an object.'}};
  const patch={},errors={};
  for(const [key,value]of Object.entries(input)){
    if(!enquiryFields.includes(key)){errors[key]='Unknown enquiry field.';continue;}
    const text=typeof value==='string'?value.trim():value;
    const error=text===''?null:enquiryFieldError(key,text);
    if(error)errors[key]=error;else patch[key]=text;
  }
  return {patch,errors};
}
export const missingEnquiryFields=draft=>enquiryFields.filter(key=>enquiryFieldError(key,draft[key]||''));
