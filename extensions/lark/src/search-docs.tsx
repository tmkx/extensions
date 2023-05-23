import React, { useState } from 'react';
import { Action, Icon, List, showToast, Toast } from '@raycast/api';
import { useCachedState } from '@raycast/utils';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SpaceListItem } from './components/space-list-item';
import { withAuth } from './features/with-auth';
import { withQuery } from './features/with-query';
import {
  fetchRecentList,
  searchDocs,
  removeRecentDocument,
  NodeType,
  RecentListResponse as RecentList,
  SearchDocsResponse as SearchResults,
} from './services/space';
import { StorageKey } from './utils/storage';
import { preference } from './utils/config';

const SearchDocsView: React.FC = () => {
  const [filterType, setFilterType] = useCachedState(StorageKey.DocsFilterType, '');
  const [cachedRecentList, setCachedRecentList] = useCachedState<RecentList | null>(StorageKey.DocsRecentList, null);
  const [searchKeywords, setSearchKeywords] = useState('');
  const filterNodeType = parseNodeType(filterType);
  const {
    isFetching,
    data: documentList,
    refetch,
  } = useQuery<SearchResults | RecentList | null>({
    queryKey: ['SearchDocsView', filterType, searchKeywords],
    queryFn: ({ signal }) =>
      searchKeywords
        ? searchDocs({ query: searchKeywords, count: preference.recentListCount, obj_types: filterNodeType }, signal)
        : fetchRecentList({ length: preference.recentListCount, obj_type: filterNodeType }, signal).then((data) => {
            setCachedRecentList(data);
            return data;
          }),
    placeholderData: (previousData) => keepPreviousData(previousData) || cachedRecentList,
  });

  const handleRemoveRecent = async (objToken: string) => {
    const result = await removeRecentDocument(objToken);
    if (result) {
      showToast(Toast.Style.Success, 'Removed successfully');
      refetch();
    }
  };

  return (
    <List
      isLoading={isFetching}
      searchBarPlaceholder="Search documents..."
      searchBarAccessory={<SearchBar storeValue onChange={setFilterType} />}
      onSearchTextChange={setSearchKeywords}
      throttle
    >
      {documentList != null && documentList.entities ? (
        isRecentList(documentList) ? (
          <RecentDocumentsView list={documentList} onRemove={handleRemoveRecent} />
        ) : (
          <SearchResultView list={documentList} />
        )
      ) : null}
    </List>
  );
};

const isRecentList = (list: RecentList | SearchResults): list is RecentList => {
  return 'nodes' in list.entities;
};

function parseNodeType(value: string): NodeType[] {
  if (!value) return [];
  return value.split(',').map(Number);
}

const SearchBar = (props: Partial<List.Dropdown.Props>) => {
  return (
    <List.Dropdown tooltip="Set filter" {...props}>
      <List.Dropdown.Item title="All types" icon={Icon.Stars} value="" />
      <List.Dropdown.Item title="Wiki" icon={`space-icons/type-${NodeType.Wik}.svg`} value={String([NodeType.Wik])} />
      <List.Dropdown.Item
        title="Docs"
        icon={`space-icons/type-${NodeType.Dox}.svg`}
        value={String([NodeType.Doc, NodeType.Dox])}
      />
      <List.Dropdown.Item title="Sheets" icon={`space-icons/type-${NodeType.Sht}.svg`} value={String([NodeType.Sht])} />
      <List.Dropdown.Item title="Slides" icon={`space-icons/type-${NodeType.Sld}.svg`} value={String([NodeType.Sld])} />
      <List.Dropdown.Item title="Base" icon={`space-icons/type-${NodeType.Bas}.svg`} value={String([NodeType.Bas])} />
      <List.Dropdown.Item
        title="MindNotes"
        icon={`space-icons/type-${NodeType.Bmn}.svg`}
        value={String([NodeType.Bmn])}
      />
      <List.Dropdown.Item title="Local files" icon={Icon.BlankDocument} value={String([NodeType.Box])} />
    </List.Dropdown>
  );
};

const RecentDocumentsView: React.FC<{
  list: RecentList;
  onRemove?: (objToken: string) => void;
}> = ({ list, onRemove }) => {
  return (
    <List.Section title="Recent Documents" subtitle={`${list.node_list.length}`}>
      {list.node_list.map((nodeId) => {
        const nodeEntity = list.entities.nodes[nodeId];
        const ownerEntity = list.entities.users[nodeEntity.owner_id];

        return (
          <SpaceListItem
            key={nodeId}
            node={nodeEntity}
            owner={ownerEntity}
            actions={
              <>
                <Action
                  icon={Icon.Trash}
                  title="Remove From Recent Documents"
                  shortcut={{ key: 'x', modifiers: ['ctrl'] }}
                  onAction={() => onRemove?.(nodeId)}
                />
              </>
            }
          />
        );
      })}
    </List.Section>
  );
};

const SearchResultView: React.FC<{ list: SearchResults }> = ({ list }) => {
  return (
    <List.Section title="Search Results" subtitle={`${list.tokens.length}`}>
      {list.tokens.map((nodeId) => {
        const objEntity = list.entities.objs[nodeId];
        const ownerEntity = list.entities.users[objEntity.owner_id];

        return <SpaceListItem key={nodeId} node={objEntity} owner={ownerEntity} />;
      })}
    </List.Section>
  );
};

export default withAuth(withQuery(SearchDocsView));
