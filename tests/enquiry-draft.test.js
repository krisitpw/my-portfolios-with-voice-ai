import test from 'node:test';
import assert from 'node:assert/strict';
import {createEnquiryDraft,ENQUIRY_FUNCTION} from '../server/enquiry-tool.mjs';
import {enquiryFields,emptyEnquiry} from '../src/lead-fields.js';
import {crmLeadPayload} from '../server/lead-service.mjs';
test('AI collects valid fields one at a time and asks only for missing fields',()=>{
  const session=createEnquiryDraft();assert.deepEqual(session.update({}).missing,enquiryFields);
  assert.equal(session.update({name:'Test Client'}).nextField,'phone');
  assert.equal(session.update({phone:'+91 98765 43210'}).nextField,'email');
  const invalid=session.update({email:'not an address'});assert.ok(invalid.errors.email);assert.equal(invalid.draft.email,'');assert.equal(invalid.nextField,'email');
  assert.equal(session.update({email:'client@example.com'}).nextField,'requirement');
  assert.equal(session.update({requirement:'wordpress-5'}).nextField,'message');
  const result=session.update({message:'A five-page website for my business.'});assert.equal(result.status,'ready_for_review');assert.equal(result.submitted,false);assert.deepEqual(result.missing,[]);assert.equal(result.draft.name,'Test Client');
});
test('all-at-once details and later corrections update the same draft; consent cannot be set by AI',()=>{
  const session=createEnquiryDraft();const result=session.update({name:'Test Client',phone:'+91 98765 43210',email:'client@example.com',requirement:'other',message:'Please build a custom appointment system.',consent:true,webhook:'https://attacker.test'});
  assert.equal(result.status,'ready_for_review');assert.ok(result.errors.consent);assert.ok(result.errors.webhook);assert.equal(result.draft.consent,undefined);assert.equal(session.update({email:'corrected@example.com'}).draft.name,'Test Client');assert.equal(session.update({email:''}).nextField,'email');
});
test('drafts isolate sessions and synchronize manually edited fields without inventing missing data',()=>{
  const first=createEnquiryDraft({name:'First Visitor'}),second=createEnquiryDraft();assert.equal(first.update({phone:'123'}).draft.phone,'');assert.deepEqual(second.update({}).draft,emptyEnquiry);assert.equal(first.update({email:'visitor@example.com'}).draft.name,'First Visitor');assert.equal(ENQUIRY_FUNCTION.defer_until_eot,true);assert.equal(ENQUIRY_FUNCTION.endpoint,undefined);
});
test('CRM mapping keeps the selected requirement separate from the project message, including older saved records',()=>{
  const common={name:'Test',phone:'1234567890',email:'test@example.com'};
  assert.deepEqual(crmLeadPayload({...common,requirement:'shopify',message:'Need a store for handmade goods.'}),{...common,requirement:'E-commerce website · Shopify',message:'Need a store for handmade goods.'});
  assert.deepEqual(crmLeadPayload({...common,service:'wordpress-5',requirements:'An older saved project enquiry.'}),{...common,requirement:'5-page website · WordPress',message:'An older saved project enquiry.'});
});
