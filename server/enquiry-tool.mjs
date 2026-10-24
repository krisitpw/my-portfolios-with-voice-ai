import {cleanEnquiryPatch,emptyEnquiry,enquiryServices,missingEnquiryFields} from '../src/lead-fields.js';
export const ENQUIRY_FUNCTION={
  name:'update_enquiry',description:'Update the visitor’s in-session enquiry draft using only details they explicitly provided, or pass an empty object to read field-completion status. Accept partial fields, one at a time or all together. This does NOT submit a lead, send email, create CRM records, or grant consent. The visitor reviews and submits the displayed form.',defer_until_eot:true,
  parameters:{type:'object',additionalProperties:false,properties:{name:{type:'string',description:'Visitor’s name, exactly as provided.'},phone:{type:'string',description:'Phone as digits; preserve the provided country code. Do not invent digits or a country code.'},email:{type:'string',description:'Email address. Convert clearly spoken at/dot and spelled-out letters; ask if unclear.'},requirement:{type:'string',enum:enquiryServices.map(item=>item.id),description:'Service ID matching the visitor’s request. Ask about WordPress/custom code if unclear, or use other for a general enquiry. Choices: '+enquiryServices.map(item=>`${item.id}: ${item.label}`).join('; ')},message:{type:'string',description:'Project description from the visitor’s own details, 10–4000 characters. Retain their requested features and timeline; do not invent scope.'}}},
};
export function createEnquiryDraft(initial={}){
  let draft={...emptyEnquiry,...cleanEnquiryPatch(initial).patch};
  return {update(input){const {patch,errors}=cleanEnquiryPatch(input);draft={...draft,...patch};const missing=missingEnquiryFields(draft);return {draft:{...draft},patch,errors,missing,nextField:missing[0]||null,status:missing.length?'collecting':'ready_for_review',submitted:false};}};
}
