-- Replace legacy Sweden-specific presentation text without changing country data.
update public.quests
set title = 'Welcome to your new home'
where id = 'q_station_arrival' and title = 'Welcome to Sweden';

update public.cities
set description = 'The internal starter city for new players.'
where id = 'city_maplewood' and description = 'The internal starter city for Sweden.';

update public.messages message
set text = replace(message.text, 'Sweden', country.name)
from public.conversations conversation
join public.characters character on character.user_id = conversation.user_id
join public.countries country on country.id = character.country_id
where message.conversation_id = conversation.id
  and message.sender = 'npc'
  and message.text in (
    'Hello! Welcome to Sweden. How can I help you?',
    'Hello! Welcome to Sweden! Where would you like to go?',
    'Welcome to Sweden! I’m the station receptionist. Say hello, and I can help you find your way.',
    'Hi! I just arrived too. Are you new to Sweden?',
    'You’re welcome! Enjoy your new life in Sweden.',
    'It’s nice to meet you! What would you like to do in Sweden?'
  );
