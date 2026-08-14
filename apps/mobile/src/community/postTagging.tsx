import Ionicons from '@react-native-vector-icons/ionicons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { CommunityGroup } from './api';
import { searchCommunityMembers, type CommunityPerson } from './circles';

export type TaggedPerson = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

export type TaggedGroup = {
  id: string;
  name: string;
};

export type PostTaggingValue = {
  people: TaggedPerson[];
  groups: TaggedGroup[];
};

export const EMPTY_POST_TAGGING: PostTaggingValue = { people: [], groups: [] };

const GOLD = '#D7B45A';
const TEXT = '#FFF8E8';
const MUTED = '#9EAAA2';
const BORDER = '#334239';
const CARD = '#121C17';

function personLabel(person: CommunityPerson) {
  return person.display_name || 'Member';
}

export function postTaggingMetadata(value: PostTaggingValue) {
  return {
    tagged_people: value.people.map((person) => ({ id: person.id, name: person.display_name })),
    tagged_groups: value.groups.map((group) => ({ id: group.id, name: group.name })),
  };
}

function metadataArray(metadata: Record<string, unknown>, key: 'tagged_people' | 'tagged_groups') {
  const value = metadata[key];
  return Array.isArray(value) ? value.filter((item): item is { id: string; name: string } => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as Record<string, unknown>;
    return typeof candidate.id === 'string' && typeof candidate.name === 'string';
  }) : [];
}

export function PostTagSummary({ metadata }: { metadata: Record<string, unknown> }) {
  const people = metadataArray(metadata, 'tagged_people');
  const groups = metadataArray(metadata, 'tagged_groups');
  if (!people.length && !groups.length) return null;

  const visible = [...people.map((item) => `@${item.name}`), ...groups.map((item) => item.name)];
  const first = visible.slice(0, 3).join(' · ');
  const remaining = Math.max(0, visible.length - 3);

  return (
    <View style={styles.summaryRow}>
      <Ionicons name="pricetag-outline" size={14} color={GOLD} />
      <Text style={styles.summaryText} numberOfLines={2}>{first}{remaining ? ` +${remaining}` : ''}</Text>
    </View>
  );
}

export function PostTaggingFields({
  groups,
  value,
  onChange,
}: {
  groups: CommunityGroup[];
  value: PostTaggingValue;
  onChange: (next: PostTaggingValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'people' | 'groups'>('people');
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<CommunityPerson[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || tab !== 'people' || query.trim().length < 2) {
      setPeople([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      void searchCommunityMembers(query)
        .then((results) => {
          if (!cancelled) setPeople(results);
        })
        .catch(() => {
          if (!cancelled) setSearchError('Unable to search members right now.');
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, tab]);

  const filteredGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return groups;
    return groups.filter((group) => group.name.toLowerCase().includes(needle));
  }, [groups, query]);

  const selectedCount = value.people.length + value.groups.length;

  function togglePerson(person: CommunityPerson) {
    const selected = value.people.some((item) => item.id === person.id);
    onChange({
      ...value,
      people: selected
        ? value.people.filter((item) => item.id !== person.id)
        : [...value.people, { id: person.id, display_name: personLabel(person), avatar_url: person.avatar_url }],
    });
  }

  function toggleGroup(group: CommunityGroup) {
    const selected = value.groups.some((item) => item.id === group.id);
    onChange({
      ...value,
      groups: selected
        ? value.groups.filter((item) => item.id !== group.id)
        : [...value.groups, { id: group.id, name: group.name }],
    });
  }

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.trigger} onPress={() => setOpen((current) => !current)}>
        <Ionicons name="at-outline" size={18} color={GOLD} />
        <Text style={styles.triggerText}>{selectedCount ? `Tagged ${selectedCount}` : 'Tag people or groups'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={MUTED} />
      </Pressable>

      {selectedCount ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectedRow} keyboardShouldPersistTaps="handled">
          {value.people.map((person) => (
            <Pressable key={`person-${person.id}`} style={styles.selectedChip} onPress={() => onChange({ ...value, people: value.people.filter((item) => item.id !== person.id) })}>
              <Ionicons name="person-outline" size={13} color={GOLD} />
              <Text style={styles.selectedChipText}>@{person.display_name}</Text>
              <Ionicons name="close" size={13} color={MUTED} />
            </Pressable>
          ))}
          {value.groups.map((group) => (
            <Pressable key={`group-${group.id}`} style={styles.selectedChip} onPress={() => onChange({ ...value, groups: value.groups.filter((item) => item.id !== group.id) })}>
              <Ionicons name="people-outline" size={13} color={GOLD} />
              <Text style={styles.selectedChipText}>{group.name}</Text>
              <Ionicons name="close" size={13} color={MUTED} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {open ? (
        <View style={styles.panel}>
          <View style={styles.tabs}>
            <Pressable style={[styles.tab, tab === 'people' && styles.tabActive]} onPress={() => { setTab('people'); setQuery(''); }}>
              <Text style={[styles.tabText, tab === 'people' && styles.tabTextActive]}>People</Text>
            </Pressable>
            <Pressable style={[styles.tab, tab === 'groups' && styles.tabActive]} onPress={() => { setTab('groups'); setQuery(''); }}>
              <Text style={[styles.tabText, tab === 'groups' && styles.tabTextActive]}>Groups</Text>
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={17} color={MUTED} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={tab === 'people' ? 'Search people' : 'Search groups'}
              placeholderTextColor="#738078"
              returnKeyType="done"
              autoCapitalize="none"
              style={styles.searchInput}
            />
          </View>

          {tab === 'people' ? (
            <View style={styles.results}>
              {searching ? <ActivityIndicator color={GOLD} style={styles.loader} /> : null}
              {searchError ? <Text style={styles.helper}>{searchError}</Text> : null}
              {!query.trim() ? <Text style={styles.helper}>Type at least 2 characters to find a member.</Text> : null}
              {query.trim().length === 1 ? <Text style={styles.helper}>Keep typing to search.</Text> : null}
              {query.trim().length >= 2 && !searching && !searchError && !people.length ? <Text style={styles.helper}>No members found.</Text> : null}
              {people.slice(0, 8).map((person) => {
                const selected = value.people.some((item) => item.id === person.id);
                return (
                  <Pressable key={person.id} style={styles.resultRow} onPress={() => togglePerson(person)}>
                    <View style={styles.avatar}>
                      {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{personLabel(person).slice(0, 1).toUpperCase()}</Text>}
                    </View>
                    <View style={styles.resultCopy}>
                      <Text style={styles.resultTitle}>{personLabel(person)}</Text>
                      {person.home_city || person.home_state ? <Text style={styles.resultMeta}>{[person.home_city, person.home_state].filter(Boolean).join(', ')}</Text> : null}
                    </View>
                    <Ionicons name={selected ? 'checkmark-circle' : 'add-circle-outline'} size={21} color={selected ? GOLD : MUTED} />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.results}>
              {!filteredGroups.length ? <Text style={styles.helper}>No groups found.</Text> : null}
              {filteredGroups.slice(0, 10).map((group) => {
                const selected = value.groups.some((item) => item.id === group.id);
                return (
                  <Pressable key={group.id} style={styles.resultRow} onPress={() => toggleGroup(group)}>
                    <View style={styles.groupIcon}><Text style={styles.groupIconText}>{group.name.slice(0, 2).toUpperCase()}</Text></View>
                    <View style={styles.resultCopy}>
                      <Text style={styles.resultTitle}>{group.name}</Text>
                      <Text style={styles.resultMeta}>{group.member_count} member{group.member_count === 1 ? '' : 's'}</Text>
                    </View>
                    <Ionicons name={selected ? 'checkmark-circle' : 'add-circle-outline'} size={21} color={selected ? GOLD : MUTED} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 7 },
  trigger: { minHeight: 40, borderWidth: 1, borderColor: BORDER, borderRadius: 11, backgroundColor: '#18231D', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10 },
  triggerText: { flex: 1, color: '#D8DED9', fontSize: 12, fontWeight: '800' },
  selectedRow: { gap: 6, paddingRight: 4 },
  selectedChip: { minHeight: 30, borderRadius: 99, borderWidth: 1, borderColor: '#46564C', backgroundColor: '#1A2821', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9 },
  selectedChipText: { color: '#DCE2DE', fontSize: 11, fontWeight: '700', maxWidth: 150 },
  panel: { borderWidth: 1, borderColor: BORDER, borderRadius: 13, backgroundColor: CARD, padding: 8, gap: 8 },
  tabs: { flexDirection: 'row', backgroundColor: '#18231D', borderRadius: 10, padding: 3 },
  tab: { flex: 1, minHeight: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: '#2A302A' },
  tabText: { color: MUTED, fontSize: 11.5, fontWeight: '800' },
  tabTextActive: { color: GOLD },
  searchBox: { minHeight: 40, borderWidth: 1, borderColor: BORDER, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 9 },
  searchInput: { flex: 1, color: TEXT, fontSize: 13, paddingVertical: 7 },
  results: { borderWidth: 1, borderColor: '#2E3B34', borderRadius: 10, overflow: 'hidden' },
  loader: { marginVertical: 12 },
  helper: { color: MUTED, fontSize: 11.5, lineHeight: 16, padding: 11 },
  resultRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 9, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#344239' },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#4A594F', backgroundColor: '#22352A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: TEXT, fontWeight: '900', fontSize: 12 },
  groupIcon: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: '#4A594F', backgroundColor: '#22352A', alignItems: 'center', justifyContent: 'center' },
  groupIconText: { color: TEXT, fontWeight: '900', fontSize: 10 },
  resultCopy: { flex: 1 },
  resultTitle: { color: TEXT, fontSize: 12.5, fontWeight: '800' },
  resultMeta: { color: MUTED, fontSize: 10.5, marginTop: 2 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#151F19', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7, alignSelf: 'flex-start', maxWidth: '100%' },
  summaryText: { flexShrink: 1, color: '#BFC8C1', fontSize: 11.5, fontWeight: '700' },
});
