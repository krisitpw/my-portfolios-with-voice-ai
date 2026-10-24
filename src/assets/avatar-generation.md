# Avatar artwork and prompts

Created with the built-in image_gen tool (imagegen skill), using the user's attached illustration as the edit target. The logo was removed before generating animation expressions. PNG files are the preserved full-quality masters; JPEG siblings are web delivery versions.

- `krishna-avatar-clean.png`: logo-free neutral frame.
- `krishna-avatar-speaking.png`: matching open-mouth frame.
- `krishna-avatar-blink.png`: matching closed-eyes frame.

## Final prompt: clean frame

Use case: precise-object-edit. Edit target: the user's attached illustrated avatar, dark hoodie, glasses, beard, purple-blue highlights on black background. Remove ONLY the white Build#Thon logo/text from the right side of the hoodie chest. Reconstruct the same plain dark fabric, crosshatching, folds and lighting in that area, seamlessly. Keep the exact face, glasses, expression, hairstyle, pose, framing, proportions, background and illustration style unchanged. Do not add any other writing, branding, symbols, or watermark. Return a single clean image in the same landscape composition.

## Final prompt: speaking frame

Use case: precise-object-edit. Input image is the exact base frame for an animated illustrated avatar. Produce a matching speaking frame: change ONLY the lips and mouth interior so this same man has his mouth naturally slightly open as if saying 'ah', with subtle visible upper teeth and dark mouth interior. Keep face, beard outer shape, eyes open, glasses, hair, head position, pose, clothing, black background, purple-blue lighting, composition, dimensions, and all pixels outside the small mouth area as close to identical as possible. Hoodie must remain completely blank, no text or logos. Do not shift, zoom, restyle, repaint, or crop the character. This must align with the input for animation.

## Final prompt: blinking frame

Use case: precise-object-edit. Input image is the exact base frame for an animated illustrated avatar. Produce a matching blink frame: change ONLY both eyelids so the same man has both eyes naturally closed in a brief blink. His mouth must stay closed exactly as in the original. Preserve the glasses, face, hair, beard, head position, pose, clothing, black background, purple-blue lighting, composition, dimensions and all pixels outside the small eye areas as close to identical as possible. Hoodie must remain blank without text or logos. Do not shift, zoom, restyle, repaint, or crop the character. This must align with the input for animation.
